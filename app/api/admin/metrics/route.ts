import { db } from '@/lib/db';
import { Order, Product } from '@/lib/models';
import { isAdmin, adminDenied } from '@/lib/security';

export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  await db();

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    products,
    totalOrders,
    paidOrders,
    pendingOrders,
    failedOrders,
    cancelledOrders,
    refundedOrders,
    partiallyRefundedOrders,
    unfulfilledPaid,
    revenueAgg,
    paymentStatusAgg,
    fulfillmentAgg,
    shippingMethodAgg,
    topProductsAgg,
    dailyAgg,
    recentOrders,
  ] = await Promise.all([
    Product.countDocuments(),
    Order.countDocuments(),
    Order.countDocuments({ paymentStatus: 'paid' }),
    Order.countDocuments({ paymentStatus: 'pending' }),
    Order.countDocuments({ paymentStatus: 'failed' }),
    Order.countDocuments({ paymentStatus: 'cancelled' }),
    Order.countDocuments({ paymentStatus: 'refunded' }),
    Order.countDocuments({ paymentStatus: 'partially_refunded' }),
    Order.countDocuments({ paymentStatus: 'paid', fulfillmentStatus: 'unfulfilled' }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' }, shipping: { $sum: '$shipping' }, discount: { $sum: '$discount' }, subtotal: { $sum: '$subtotal' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $group: { _id: '$paymentStatus', count: { $sum: 1 }, total: { $sum: '$total' } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $group: { _id: '$fulfillmentStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $group: { _id: '$shippingMethod', count: { $sum: 1 }, shipping: { $sum: '$shipping' } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
      { $sort: { qty: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0 ] } } } },
      { $sort: { _id: 1 } },
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('number total paymentStatus fulfillmentStatus createdAt customer.name customer.city simulation')
      .lean(),
  ]);

  const revenue = revenueAgg[0]?.total || 0;
  const shippingRevenue = revenueAgg[0]?.shipping || 0;
  const discountTotal = revenueAgg[0]?.discount || 0;
  const subtotal = revenueAgg[0]?.subtotal || 0;
  const paidCount = revenueAgg[0]?.count || 0;
  const averageOrderValue = paidCount ? revenue / paidCount : 0;
  const itemsSoldAgg = await Order.aggregate([
    { $unwind: '$items' },
    { $group: { _id: null, qty: { $sum: '$items.qty' } } },
  ]);
  const itemsSold = itemsSoldAgg[0]?.qty || 0;

  return Response.json({
    products,
    orders: totalOrders,
    revenue,
    shippingRevenue,
    discountTotal,
    subtotal,
    paidOrders,
    pendingOrders,
    failedOrders,
    cancelledOrders,
    refundedOrders,
    partiallyRefundedOrders,
    unfulfilledPaid,
    averageOrderValue,
    itemsSold,
    paymentStatus: paymentStatusAgg.map((r: any) => ({ status: r._id || 'unknown', count: r.count, total: r.total || 0 })),
    fulfillmentStatus: fulfillmentAgg.map((r: any) => ({ status: r._id || 'unknown', count: r.count })),
    shippingMethods: shippingMethodAgg.map((r: any) => ({ method: r._id || 'unknown', count: r.count, shipping: r.shipping || 0 })),
    topProducts: topProductsAgg.map((r: any) => ({ name: r._id || 'Unknown', qty: r.qty || 0, revenue: r.revenue || 0 })),
    daily: dailyAgg.map((r: any) => ({ date: r._id, orders: r.orders, revenue: r.revenue || 0 })),
    recentOrders: recentOrders.map((o: any) => ({
      number: o.number,
      total: o.total,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      createdAt: o.createdAt,
      customer: o.customer?.name || '',
      city: o.customer?.city || '',
      simulation: !!o.simulation,
    })),
  });
}
