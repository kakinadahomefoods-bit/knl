import { isAdmin, adminDenied } from '@/lib/security';
import { db } from '@/lib/db';
import { Order } from '@/lib/models';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAdmin())) return adminDenied();
  await db();
  const shipments = await Order.find({ 'shipment.awb': { $exists: true, $ne: '' } })
    .sort({ createdAt: -1 })
    .limit(300)
    .select('number paymentStatus fulfillmentStatus customer shipment createdAt')
    .lean();
  return Response.json({
    shipments: shipments.map((s: any) => ({ ...s, _id: String(s._id) })),
  });
}
