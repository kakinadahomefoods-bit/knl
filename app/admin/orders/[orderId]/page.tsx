'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type Any = Record<string, any>;

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.orderId || '');

  const [checking, setChecking] = useState(true);
  const [logged, setLogged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [order, setOrder] = useState<Any | null>(null);
  const [payment, setPayment] = useState<Any | null>(null);

  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        const r = await fetch('/api/admin/session');
        const x = await r.json();
        if (x.authenticated) setLogged(true);
        else router.push('/admin');
      } catch {
        router.push('/admin');
      } finally {
        setChecking(false);
      }
    }
    checkSession();
  }, [router]);

  async function loadOrder() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/orders/' + encodeURIComponent(orderId));
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'Failed to load order');
      setOrder({ ...x.order, _id: String(x.order._id) });
      setPayment(x.payment || null);
      setStatus(String(x.order.fulfillmentStatus || 'pending'));
      setTrackingNumber(String(x.order.shipment?.awb || ''));
      setCourier(String(x.order.shipment?.courier || 'Delhivery'));
    } catch (e: any) {
      setError(e.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (logged && orderId) loadOrder();
  }, [logged, orderId]);

  async function updateStatus() {
    if (!order) return;
    if (status === 'cancelled') {
      if (!window.confirm('Are you sure you want to cancel this order?')) return;
    }
    setUpdating(true);
    setMsg('');
    try {
      const r = await fetch('/api/admin/orders/' + encodeURIComponent(orderId) + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes,
          trackingNumber,
          courier,
          confirm: status === 'cancelled',
        }),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'Update failed');
      setOrder({ ...x.order, _id: String(x.order._id) });
      setMsg('Order status updated successfully');
      setIsError(false);
      setNotes('');
    } catch (e: any) {
      setMsg(e.message || 'Update failed');
      setIsError(true);
    } finally {
      setUpdating(false);
    }
  }

  if (checking) return <main className="page-shell prose"><p>Checking session…</p></main>;
  if (!logged) return null;

  return (
    <div className="admin">
      <aside className="admin-sidebar">
        <div className="admin-logo"><img src="/cruvita-logo-transparent.png" alt="Cruvita Cookies" className="admin-sidebar-logo" /><small>STORE ADMIN</small></div>
        <Link href="/admin" className="admin-link-button" style={{ textAlign: 'center', marginBottom: 12 }}>← Back to Orders</Link>
      </aside>
      <main className="admin-main">
        <div className="admin-top"><h1>Order Details</h1></div>
        {msg && <div className={'notice ' + (isError ? 'notice-error' : 'notice-success')}>{msg}</div>}
        {error && <div className="notice notice-error">{error}</div>}
        {loading && <p className="muted">Loading order…</p>}

        {!loading && order && (
          <>
            <div style={{ marginBottom: 12 }}>
              <button className="outline-button" onClick={() => router.push('/admin')}>Back to Orders</button>
            </div>

            <div className="tracking-card" style={{ maxWidth: 920, textAlign: 'left' }}>
              <h2>Order {order.number}</h2>
              <div className="admin-line"><span>Order ID</span><strong>{order._id}</strong></div>
              <div className="admin-line"><span>Order date</span><strong>{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</strong></div>
              <div className="admin-line"><span>Current status</span><strong>{order.fulfillmentStatus}</strong></div>
              <div className="admin-line"><span>Payment status</span><strong>{order.paymentStatus}</strong></div>

              <h3>Customer Information</h3>
              <div className="admin-line"><span>Name</span><strong>{order.customer?.name || '—'}</strong></div>
              <div className="admin-line"><span>Email</span><strong>{order.customer?.email || '—'}</strong></div>
              <div className="admin-line"><span>Phone</span><strong>{order.customer?.phone || '—'}</strong></div>

              <h3>Shipping / Billing Address</h3>
              <div className="admin-line"><span>House number</span><strong>{order.customer?.houseNo || '—'}</strong></div>
              <div className="admin-line"><span>Street</span><strong>{order.customer?.street || '—'}</strong></div>
              <div className="admin-line"><span>Landmark</span><strong>{order.customer?.landmark || '—'}</strong></div>
              <div className="admin-line"><span>City</span><strong>{order.customer?.city || '—'}</strong></div>
              <div className="admin-line"><span>State</span><strong>{order.customer?.state || '—'}</strong></div>
              <div className="admin-line"><span>PIN code</span><strong>{order.customer?.pin || '—'}</strong></div>
              <div className="admin-line"><span>Complete address</span><strong>{order.customer?.address || '—'}</strong></div>

              <h3>Ordered Products</h3>
              {(order.items || []).map((item: Any, idx: number) => (
                <div className="admin-line" key={idx}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.image && <img src={item.image} alt={item.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />}
                    {item.name} × {item.qty}
                  </span>
                  <strong>₹{item.price} each · ₹{Number(item.price) * Number(item.qty)}</strong>
                </div>
              ))}
              <div className="admin-line"><span>Subtotal</span><strong>₹{order.subtotal}</strong></div>
              <div className="admin-line"><span>Shipping charges</span><strong>₹{order.shipping}</strong></div>
              {order.discount ? <div className="admin-line"><span>Discount</span><strong>-₹{order.discount}</strong></div> : null}
              <div className="admin-line"><span>Total amount</span><strong>₹{order.total}</strong></div>

              <h3>Payment Information</h3>
              <div className="admin-line"><span>Razorpay payment ID</span><strong>{order.razorpayPaymentId || payment?.razorpayPaymentId || '—'}</strong></div>
              <div className="admin-line"><span>Payment status</span><strong>{order.paymentStatus}</strong></div>
              <div className="admin-line"><span>Payment method</span><strong>{payment?.method || '—'}</strong></div>
              <div className="admin-line"><span>Payment verification</span><strong>{payment?.signatureVerified ? 'Verified' : 'Not verified'}</strong></div>

              <h3>Shipment / Tracking</h3>
              <div className="admin-line"><span>Shipment ID</span><strong>{order.shipment?.shipmentId || '—'}</strong></div>
              <div className="admin-line"><span>AWB / Tracking number</span><strong>{order.shipment?.awb || '—'}</strong></div>
              <div className="admin-line"><span>Shipment status</span><strong>{order.shipment?.status || '—'}</strong></div>
              <div className="admin-line"><span>Courier</span><strong>{order.shipment?.courier || '—'}</strong></div>
              <div className="admin-line"><span>Tracking URL</span><strong>{order.shipment?.trackingUrl ? <a href={order.shipment.trackingUrl} target="_blank" rel="noopener">{order.shipment.trackingUrl}</a> : '—'}</strong></div>

              {(order.shipment?.trackingEvents || order.shipment?.updates || []).length > 0 && (
                <>
                  <h4>Tracking history</h4>
                  <ul className="tracking-timeline">
                    {(order.shipment?.trackingEvents || order.shipment?.updates || []).map((u: Any, idx: number) => (
                      <li key={idx}>
                        <strong>{u.status}</strong> {u.location ? `— ${u.location}` : ''}
                        <small>{u.at ? new Date(u.at).toLocaleString() : ''}{u.description ? ` · ${u.description}` : ''}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3>Order Status History</h3>
              {(order.history || []).length === 0 ? <p className="muted">No status history yet.</p> : (
                <ul className="tracking-timeline">
                  {(order.history || []).map((h: Any, idx: number) => (
                    <li key={idx}>
                      <strong>{h.from || '—'} → {h.to}</strong> {h.trackingNumber ? `· AWB ${h.trackingNumber}` : ''} {h.courier ? `· ${h.courier}` : ''}
                      <small>{h.at ? new Date(h.at).toLocaleString() : ''}{h.by ? ` · by ${h.by}` : ''}{h.notes ? ` · ${h.notes}` : ''}</small>
                    </li>
                  ))}
                </ul>
              )}

              <h3>Update Order Status</h3>
              <div className="admin-line">
                <span>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <label>Admin notes (optional)
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <label>Tracking number (optional)
                <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
              </label>
              <label>Courier (optional)
                <input value={courier} onChange={(e) => setCourier(e.target.value)} />
              </label>
              <div style={{ marginTop: 12 }}>
                <button className="primary-button" disabled={updating} onClick={updateStatus}>
                  {updating ? 'Updating…' : 'Update Status'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}