import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  await db();
  const shipments = await Order.find({
    $or: [
      { 'shipment.awb': { $exists: true, $ne: '' } },
      { paymentStatus: 'paid', 'shipment.creationState': { $in: ['creating', 'failed'] } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(300)
    .select('number paymentStatus fulfillmentStatus customer shipment shipping shippingQuote simulation items createdAt')
    .lean();
  return Response.json({
    shipments: shipments.map((s: any) => ({
      ...s,
      _id: String(s._id),
      itemCount: Array.isArray(s.items) ? s.items.reduce((sum: number, i: any) => sum + (Number(i.qty) || 0), 0) : 0,
    })),
  });
}
