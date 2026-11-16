import mongoose from 'mongoose';
import { db } from '@/lib/db';
import { Order, Product, Coupon, Payment } from '@/lib/models';
import { notifyOrder, orderConfirmationEmail, paymentConfirmationEmail, deliveryEmail } from '@/lib/email';

export type FinalizeMeta = {
  paymentId?: string;
  simulation?: boolean;
  signatureVerified?: boolean;
  method?: string;
};

/**
 * Idempotent finalization:
 *  - marks the order paid exactly once
 *  - records a Payment document (duplicate payment ids are rejected by a unique index)
 *  - atomically decrements stock for all lines (all-or-nothing transaction)
 *  - commits coupon usage inside the same transaction
 *  - records honest notification status for the confirmation emails
 */
export async function finalizePayment(razorpayOrderId: string, meta: FinalizeMeta = {}) {
  await db();
  const paymentId = meta.paymentId;

  const paidOrder = await Order.findOneAndUpdate(
    { razorpayOrderId, paymentStatus: { $ne: 'paid' } },
    {
      $set: {
        paymentStatus: 'paid',
        ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
        ...(meta.simulation ? { simulation: true } : {}),
      },
    },
    { new: true }
  );
  const order = paidOrder || (await Order.findOne({ razorpayOrderId }));
  if (!order) return null;

  if (paymentId) {
    try {
      await Payment.findOneAndUpdate(
        { razorpayOrderId },
        {
          $setOnInsert: {
            orderId: order._id,
            number: order.number,
            amount: order.total,
            currency: 'INR',
          },
          $set: {
            razorpayOrderId,
            razorpayPaymentId: paymentId,
            status: 'captured',
            method: meta.method || (meta.simulation ? 'simulation' : undefined),
            simulation: Boolean(meta.simulation),
            signatureVerified: Boolean(meta.signatureVerified),
          },
        },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.error('[fulfillment] payment record conflict', (e as Error).message);
    }
  }

  if (order.inventoryCommitted) return order;

  const session = await mongoose.startSession();
  let committed = false;
  let failure: string | null = null;
  try {
    await session.withTransaction(async () => {
      const claim = await Order.findOneAndUpdate(
        { _id: order._id, inventoryCommitted: false },
        { $set: { inventoryCommitted: true } },
        { new: true, session }
      );
      if (!claim) return;

      for (const item of claim.items) {
        const updated = await Product.updateOne(
          { _id: item.productId, stock: { $gte: item.qty } },
          { $inc: { stock: -item.qty } },
          { session }
        );
        if (!updated.modifiedCount) throw new Error('Insufficient inventory for ' + item.name);
      }

      if (claim.coupon && !claim.couponCommitted) {
        const coupon = await Coupon.findOne({ code: claim.coupon, enabled: true }).session(session);
        if (coupon) {
          await Coupon.updateOne({ _id: coupon._id }, { $inc: { used: 1 } }, { session });
          await Order.updateOne({ _id: claim._id }, { $set: { couponCommitted: true } }, { session });
        }
      }
      committed = true;
    });
  } catch (e) {
    failure = (e as Error).message || 'Inventory transaction failed';
    console.error('[fulfillment] inventory transaction failed:', failure);
  } finally {
    await session.endSession();
  }

  if (failure) {
    await Order.updateOne(
      { _id: order._id },
      { $set: { inventoryError: failure, fulfillmentStatus: 'review_required', inventoryCommitted: false } }
    );
  } else if (committed && order.customer?.email) {
    try {
      const a = orderConfirmationEmail(order);
      await notifyOrder(order._id, 'order_confirmation', {
        to: order.customer.email,
        subject: a.subject,
        html: a.html,
        text: a.text,
      });
      const b = paymentConfirmationEmail(order);
      await notifyOrder(order._id, 'payment_confirmation', {
        to: order.customer.email,
        subject: b.subject,
        html: b.html,
        text: b.text,
      });
    } catch (e) {
      console.error('[fulfillment] notification step failed', (e as Error).message);
    }
  }

  return Order.findById(order._id);
}

export async function markOrderDelivered(orderId: string) {
  await db();
  const order = await Order.findById(orderId);
  if (!order || order.fulfillmentStatus === 'delivered') return order;
  order.fulfillmentStatus = 'delivered';
  if (order.shipment) order.shipment.status = 'delivered';
  await order.save();
  if (order.customer?.email) {
    const { subject, html, text } = deliveryEmail(order);
    await notifyOrder(order._id, 'delivery', { to: order.customer.email, subject, html, text });
  }
  return order;
}
