import { isAdmin, adminDenied } from '@/lib/security';
import { getShipmentLabel } from '@/lib/shipping-service';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  const orderId = new URL(req.url).searchParams.get('orderId') || '';
  if (!mongoose.isValidObjectId(orderId)) return Response.json({ error: 'Invalid order id' }, { status: 400 });

  const result = await getShipmentLabel(orderId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  if (result.redirect) return Response.redirect(result.redirect, 302);

  // Base64 avoids a double base64 round-trip on a binary PDF body.
  const bytes = Buffer.from(result.body || '', result.contentType?.startsWith('text/') ? 'utf8' : 'base64');
  const disposition = result.fileName?.endsWith('.html') ? 'inline' : 'attachment';
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': result.contentType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${result.fileName || 'shipping-label'}"`,
      'Cache-Control': 'no-store',
    },
  });
}
