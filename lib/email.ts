import { db } from '@/lib/db';
import { Order } from '@/lib/models';
import { emailConfigured } from '@/lib/config';

type EmailPayload = { to: string; subject: string; html: string; text?: string };

/** Returns true only when a provider accepted the message. Never pretend otherwise. */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!emailConfigured()) {
    console.info('[email] No provider configured; email not sent:', payload.subject);
    return false;
  }
  const from = process.env.EMAIL_FROM || 'Cruvita Cookies <orders@cruvitacookies.com>';
  const url = process.env.EMAIL_API_URL || 'https://api.resend.com/emails';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text }),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[email] Provider rejected message with status', res.status);
      return false;
    }
    return true;
  } catch {
    console.error('[email] Delivery failed');
    return false;
  }
}

/** Send and persist an honest delivery record on the order. */
export async function notifyOrder(
  orderId: unknown,
  type: string,
  payload: EmailPayload
): Promise<boolean> {
  const sent = await sendEmail(payload);
  try {
    await db();
    await Order.updateOne(
      { _id: orderId },
      {
        $push: {
          notifications: {
            type,
            sent,
            at: new Date(),
            detail: sent ? 'accepted by provider' : 'not sent (no provider configured or provider error)',
          },
        },
      }
    );
  } catch {
    console.error('[email] Could not record notification status');
  }
  return sent;
}

const shell = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;color:#40241e"><h2>${title}</h2>${body}<p style="color:#826c64">— Cruvita Cookies</p></div>`;

const itemList = (order: any) =>
  '<ul>' + (order.items || []).map((i: any) => `<li>${i.name} × ${i.qty} — ₹${i.price * i.qty}</li>`).join('') + '</ul>';

export function orderConfirmationEmail(order: any) {
  return {
    subject: `Your Cruvita Cookies order ${order.number} is confirmed`,
    html: shell('Thank you for your order!', `<p>Order <strong>${order.number}</strong></p>${itemList(order)}<p>Total: ₹${order.total}</p><p>Tracking token: <code>${order.trackingToken}</code></p>`),
    text: `Order ${order.number} confirmed. Total ₹${order.total}. Tracking token: ${order.trackingToken}`,
  };
}

export function paymentConfirmationEmail(order: any) {
  return {
    subject: `Payment received for order ${order.number}`,
    html: shell('Payment received', `<p>We have received payment of ₹${order.total} for order <strong>${order.number}</strong>.</p>`),
    text: `Payment of ₹${order.total} received for order ${order.number}.`,
  };
}

export function shipmentEmail(order: any, awb: string, simulated = false) {
  const label = simulated ? ' (simulated shipment)' : '';
  return {
    subject: `Your Cruvita Cookies order ${order.number} has shipped${label}`,
    html: shell('Your order has shipped', `<p>Order <strong>${order.number}</strong> has shipped. Tracking ID: <strong>${awb}</strong>${label}.</p>`),
    text: `Order ${order.number} shipped. Tracking ID ${awb}${label}.`,
  };
}

export function deliveryEmail(order: any) {
  return {
    subject: `Delivered: order ${order.number}`,
    html: shell('Delivered', `<p>Order <strong>${order.number}</strong> has been marked delivered. We hope you enjoy every bite!</p>`),
    text: `Order ${order.number} delivered.`,
  };
}

export function cancellationEmail(order: any, reason?: string) {
  return {
    subject: `Order ${order.number} cancelled`,
    html: shell('Order cancelled', `<p>Order <strong>${order.number}</strong> has been cancelled.${reason ? ` Reason: ${reason}` : ''}</p>`),
    text: `Order ${order.number} cancelled.${reason ? ` Reason: ${reason}` : ''}`,
  };
}

export function refundEmail(order: any, amount: number) {
  return {
    subject: `Refund processed for order ${order.number}`,
    html: shell('Refund processed', `<p>A refund of ₹${amount} has been processed for order <strong>${order.number}</strong>.</p>`),
    text: `Refund ₹${amount} for order ${order.number}.`,
  };
}
