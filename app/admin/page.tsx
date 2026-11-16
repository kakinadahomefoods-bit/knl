'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Any = Record<string, any>;
const SECTIONS = [
  'Dashboard', 'Products', 'Categories', 'Inventory', 'Orders', 'Payments',
  'Shipments', 'Coupons', 'Banners', 'Policies', 'SEO', 'Settings', 'Media',
];

const MEDIA_FOLDERS = [
  ['cruvita/products', 'Product images'],
  ['cruvita/banners', 'Homepage banners'],
  ['cruvita/categories', 'Category images'],
  ['cruvita/logo', 'Website logo'],
];

export default function Admin() {
  const [logged, setLogged] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('Dashboard');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [items, setItems] = useState<Any[]>([]);
  const [metrics, setMetrics] = useState<Any>({});
  const [edit, setEdit] = useState<Any>({});
  const [settings, setSettings] = useState<Any>({});
  const [homepage, setHomepage] = useState<Any>({});
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState('cruvita/products');
  const [uploadTarget, setUploadTarget] = useState<'edit' | 'homepage' | 'settings'>('edit');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Any | null>(null);

  function report(text: string, error = false) { setMsg(text); setIsError(error); }

  async function api(path: string, method = 'GET', body?: any) {
    const r = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const x = await r.json();
    if (!r.ok) throw new Error(x.error || 'Request failed');
    return x;
  }

  async function load(section = tab) {
    try {
      if (section === 'Dashboard') setMetrics(await api('/api/admin/metrics'));
      if (section === 'Products') setItems((await api('/api/products?admin=1')).products || []);
      if (section === 'Categories') setItems((await api('/api/admin/categories')).categories || []);
      if (section === 'Inventory') setItems((await api('/api/products?admin=1')).products || []);
      if (section === 'Orders') setItems((await api('/api/admin/orders')).orders || []);
      if (section === 'Payments') setItems((await api('/api/admin/payments')).payments || []);
      if (section === 'Shipments') setItems((await api('/api/admin/shipments')).shipments || []);
      if (section === 'Coupons') setItems((await api('/api/admin/coupons')).coupons || []);
      if (section === 'Banners') {
        setItems((await api('/api/admin/banners')).banners || []);
        const content = (await api('/api/content')).content || [];
        setHomepage(content.find((c: Any) => c.key === 'homepage')?.value || {});
      }
      if (['Policies', 'SEO', 'Settings'].includes(section)) setSettings((await api('/api/admin/settings')).settings || {});
      if (section === 'Media') setItems((await api('/api/admin/media')).media || []);
    } catch (e: any) { report(e.message, true); }
  }

  useEffect(() => {
    api('/api/admin/session')
      .then((x) => { if (x.authenticated) { setLogged(true); load('Dashboard'); } })
      .catch(() => {})
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/login', 'POST', { email, password });
      setLogged(true); setPassword(''); setMsg(''); load('Dashboard');
    } catch (e: any) { report(e.message, true); }
  }

  function selectTab(s: string) { setTab(s); setEdit({}); setDetail(null); setMsg(''); load(s); }

  async function upload(targetFolder = folder, target: 'edit' | 'homepage' | 'settings' = uploadTarget) {
    if (!file) return report('Choose an image first', true);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', targetFolder);
      const r = await fetch('/api/upload', { method: 'POST', body: form });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'Upload failed');
      if (target === 'homepage') {
        setHomepage((v: Any) => ({ ...v, image: x.url }));
      } else if (target === 'settings') {
        setSettings((s) => ({ ...s, logo: x.url }));
      } else {
        setEdit((p: Any) => ({
          ...p,
          images: targetFolder === 'cruvita/products' ? [...(Array.isArray(p.images) ? p.images : []), x.url] : p.images,
          image: targetFolder !== 'cruvita/products' ? x.url : p.image,
          logo: targetFolder === 'cruvita/logo' ? x.url : p.logo,
          publicId: targetFolder !== 'cruvita/products' ? x.publicId : p.publicId,
        }));
      }
      if (tab === 'Media') load('Media');
      report('Uploaded to Cloudinary', false);
    } catch (e: any) { report(e.message, true); } finally { setBusy(false); }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...edit,
        price: Number(edit.price), compareAt: edit.compareAt ? Number(edit.compareAt) : undefined,
        stock: Number(edit.stock), lowStockAt: Number(edit.lowStockAt ?? 5), weightGrams: Number(edit.weightGrams || 250),
        images: typeof edit.images === 'string' ? edit.images.split(',').map((s: string) => s.trim()).filter(Boolean) : edit.images || [],
        tags: typeof edit.tags === 'string' ? edit.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : edit.tags || [],
      };
      if (edit._id) await api('/api/products/' + edit._id, 'PATCH', payload);
      else await api('/api/products', 'POST', payload);
      setEdit({}); report('Product saved', false); load('Products');
    } catch (e: any) { report(e.message, true); }
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (edit._id) await api('/api/admin/categories/' + edit._id, 'PATCH', edit);
      else await api('/api/admin/categories', 'POST', edit);
      setEdit({}); report('Category saved', false); load('Categories');
    } catch (e: any) { report(e.message, true); }
  }

  async function saveCoupon(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/api/admin/coupons', 'POST', edit); setEdit({}); report('Coupon saved', false); load('Coupons'); }
    catch (e: any) { report(e.message, true); }
  }

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/content', 'PUT', { key: 'homepage', value: homepage });
      report('Homepage updated', false);
    } catch (e: any) { report(e.message, true); }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/api/admin/settings', 'PUT', settings); report('Settings saved', false); }
    catch (e: any) { report(e.message, true); }
  }

  const field = (key: string, label = key, multi = false) => (
    <label key={key}>{label}{multi
      ? <textarea value={edit[key] ?? ''} onChange={(e) => setEdit((v) => ({ ...v, [key]: e.target.value }))} />
      : <input value={edit[key] ?? ''} onChange={(e) => setEdit((v) => ({ ...v, [key]: e.target.value }))} />}</label>
  );

  const uploader = (targetFolder = folder, target: 'edit' | 'homepage' | 'settings' = 'edit') => <>
    <label className="muted tiny">{MEDIA_FOLDERS.find(([v]) => v === targetFolder)?.[1] || 'Image'} (Cloudinary)</label>
    <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
    <button type="button" disabled={busy || !file} onClick={() => { setFolder(targetFolder); setUploadTarget(target); upload(targetFolder, target); }}>
      {busy ? 'Uploading…' : 'Upload to Cloudinary'}
    </button>
  </>;

  if (checking) return <main className="page-shell prose"><p>Checking session…</p></main>;

  if (!logged) return <main className="page-shell prose">
    <h1>Cruvita <i>Admin Login</i></h1>
    <form className="checkout-form" onSubmit={login}>
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="primary-button">Sign in</button>
    </form>
    {msg && <p role="alert" className="notice notice-error">{msg}</p>}
    <Link href="/">← Storefront</Link>
  </main>;

  return <div className="admin">
    <aside className="admin-sidebar">
      <div className="admin-logo">✿ Cruvita Cookies <small>STORE ADMIN</small></div>
      {SECTIONS.map((s) => <button className={tab === s ? 'selected' : ''} key={s} onClick={() => selectTab(s)}>{s}</button>)}
      <button onClick={async () => { await api('/api/admin/logout', 'POST'); setLogged(false); }}>Sign out</button>
      <Link href="/">← Back to Store</Link>
    </aside>
    <main className="admin-main">
      <div className="admin-top"><h1>{tab}</h1></div>
      {msg && <div className={'notice ' + (isError ? 'notice-error' : 'notice-success')}>{msg}</div>}

      {tab === 'Dashboard' && <>
        <div className="stats">
          {[
            ['Total Revenue', '₹' + (metrics.revenue || 0)],
            ['Orders', metrics.orders || 0],
            ['Products', metrics.products || 0],
            ['Awaiting Shipment', metrics.pending || 0],
          ].map(([a, b]) => <div className="stat" key={String(a)}><span>{a}</span><strong>{b}</strong></div>)}
        </div>
        <p className="muted">Use the sidebar to manage catalogues, orders, payments and website content. All records shown here come from MongoDB.</p>
      </>}

      {tab === 'Products' && <>
        <button className="primary-button" onClick={() => { setEdit({ name: '', category: 'Cookies', price: 0, stock: 0, published: true }); setFile(null); }}>+ Add Product</button>
        <div className="admin-panel">{items.map((p) => <div className="admin-line" key={p._id}>
          <span>{p.name} — ₹{p.price} — stock {p.stock} {p.published ? '(Published)' : '(Draft)'}</span>
          <button onClick={() => { setEdit({ ...p }); setFolder('cruvita/products'); }}>Edit</button>
          <button onClick={async () => { if (confirm('Unpublish this product?')) { await api('/api/products/' + p._id, 'DELETE'); load('Products'); } }}>Unpublish</button>
        </div>)}</div>
        {'name' in edit && <form className="checkout-form" onSubmit={saveProduct}>
          <h2>{edit._id ? 'Edit' : 'Add'} Product</h2>
          {['name', 'slug', 'category', 'description', 'price', 'compareAt', 'stock', 'lowStockAt', 'weightGrams', 'tags'].map((k) => field(k, k === 'lowStockAt' ? 'Low stock alert at' : k, k === 'description' || k === 'tags'))}
          <label><input type="checkbox" checked={!!edit.published} onChange={(e) => setEdit((v) => ({ ...v, published: e.target.checked }))} /> Published</label>
          <label><input type="checkbox" checked={!!edit.featured} onChange={(e) => setEdit((v) => ({ ...v, featured: e.target.checked }))} /> Featured</label>
          <label>Image URLs (comma-separated)<textarea value={Array.isArray(edit.images) ? edit.images.join(', ') : edit.images || ''} onChange={(e) => setEdit((v) => ({ ...v, images: e.target.value }))} /></label>
          {uploader('cruvita/products')}
          <button className="primary-button">Save Product</button>
        </form>}
      </>}

      {tab === 'Categories' && <>
        <button className="primary-button" onClick={() => setEdit({ name: '', published: true, sortOrder: 0 })}>+ Add Category</button>
        <div className="admin-panel">{items.map((c) => <div className="admin-line" key={c._id}>
          <span>{c.name} ({c.slug}) {c.published ? '' : '— hidden'}</span>
          <button onClick={() => { setEdit({ ...c }); setFolder('cruvita/categories'); }}>Edit</button>
          <button onClick={async () => { if (confirm('Delete category?')) { await api('/api/admin/categories/' + c._id, 'DELETE'); load('Categories'); } }}>Delete</button>
        </div>)}</div>
        {'name' in edit && <form className="checkout-form" onSubmit={saveCategory}>
          <h2>{edit._id ? 'Edit' : 'Add'} Category</h2>
          {['name', 'slug', 'description', 'image', 'publicId', 'sortOrder'].map((k) => field(k, k, k === 'description'))}
          <label><input type="checkbox" checked={edit.published !== false} onChange={(e) => setEdit((v) => ({ ...v, published: e.target.checked }))} /> Published</label>
          {uploader('cruvita/categories')}
          <button className="primary-button">Save Category</button>
        </form>}
      </>}

      {tab === 'Inventory' && <>
        <p className="muted">Change stock quantities directly. Updates are saved to MongoDB and reflected on the storefront immediately.</p>
        <div className="admin-panel">{items.map((p) => <div className="admin-line" key={p._id}>
          <span>{p.name} — {p.stock} in stock <small>{p.stock <= (p.lowStockAt ?? 5) ? '• Low stock' : ''}</small></span>
          <input type="number" min="0" defaultValue={p.stock} style={{ width: 90 }}
            onChange={(e) => { p.stock = Number(e.target.value); }} />
          <button onClick={async () => { try { await api('/api/products/' + p._id, 'PATCH', { stock: Number(p.stock) }); report('Stock updated', false); load('Inventory'); } catch (e: any) { report(e.message, true); } }}>Save</button>
        </div>)}</div>
      </>}

      {tab === 'Orders' && <div className="admin-panel">{items.map((o) => <div className="admin-line" key={o._id}>
        <span>{o.number} — ₹{o.total} — {o.paymentStatus} / {o.fulfillmentStatus} — {o.customer?.name} — {o.customer?.pin}{o.simulation ? ' (SIMULATED)' : ''}</span>
        <button onClick={async () => { try { const x = await api('/api/admin/orders/' + o._id); setDetail(x.order); } catch (e: any) { report(e.message, true); } }}>View</button>
        <button onClick={async () => { try { await api('/api/admin/orders/' + o._id + '/reconcile', 'POST'); report('Reconciled', false); load('Orders'); } catch (e: any) { report(e.message, true); } }}>Reconcile</button>
        <button disabled={o.paymentStatus !== 'paid' && o.paymentStatus !== 'partially_refunded'} onClick={async () => {
          const amt = prompt('Refund amount (blank = full)', String(o.total - (o.refundAmount || 0)));
          try { await api('/api/admin/orders/' + o._id + '/refund', 'POST', amt ? { amount: Number(amt) } : {}); report('Refund processed', false); load('Orders'); }
          catch (e: any) { report(e.message, true); }
        }}>Refund</button>
        <button onClick={async () => { const reason = prompt('Cancellation reason (optional)') || ''; try { await api('/api/admin/orders/' + o._id + '/cancel', 'POST', { reason }); report('Order cancelled', false); load('Orders'); } catch (e: any) { report(e.message, true); } }}>Cancel</button>
      </div>)}</div>}
      {detail && <div className="tracking-card"><h2>{detail.number}</h2><pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', maxHeight: 360, overflow: 'auto' }}>{JSON.stringify(detail, null, 2)}</pre><button onClick={() => setDetail(null)}>Close</button></div>}

      {tab === 'Payments' && <div className="admin-panel">{items.map((p) => <div className="admin-line" key={p._id}>
        <span>{p.number} — ₹{p.amount} — {p.status} — {p.simulation ? 'SIMULATED' : p.method || 'gateway'} — {p.razorpayPaymentId || 'awaiting payment'}</span>
      </div>)}</div>}

      {tab === 'Shipments' && <div className="admin-panel">{items.map((s) => <div className="admin-line" key={s._id}>
        <span>{s.number} — AWB {s.shipment?.awb} — {s.shipment?.status}{s.shipment?.simulated ? ' (SIMULATED)' : ''} — {s.customer?.name}</span>
        <button onClick={async () => { try { const x = await api('/api/shipping/track?awb=' + encodeURIComponent(s.shipment.awb)); setDetail(x); } catch (e: any) { report(e.message, true); } }}>Track</button>
        <button onClick={async () => { try { await api('/api/shipping/cancel', 'POST', { orderId: s._id }); report('Shipment cancelled', false); load('Shipments'); } catch (e: any) { report(e.message, true); } }}>Cancel</button>
      </div>)}</div>}
      {tab === 'Shipments' && detail && <div className="tracking-card"><pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', maxHeight: 320, overflow: 'auto' }}>{JSON.stringify(detail, null, 2)}</pre><button onClick={() => setDetail(null)}>Close</button></div>}

      {tab === 'Coupons' && <>
        <div className="admin-panel">{items.map((c) => <div className="admin-line" key={c._id}>
          <span>{c.code} — {c.type} {c.value} — used {c.used || 0} — {c.enabled ? 'Enabled' : 'Disabled'}</span>
          <button onClick={() => setEdit({ ...c })}>Edit</button>
          <button onClick={async () => { if (confirm('Delete coupon?')) { await api('/api/admin/coupons', 'DELETE', { id: c._id }); load('Coupons'); } }}>Delete</button>
        </div>)}</div>
        <form className="checkout-form" onSubmit={saveCoupon}>
          <h2>Create / Update Coupon</h2>
          {['code', 'value', 'minOrder', 'maxDiscount', 'usageLimit', 'expiresAt'].map((k) => field(k))}
          <label>Type<select value={edit.type || 'percent'} onChange={(e) => setEdit((v) => ({ ...v, type: e.target.value }))}><option value="percent">Percent</option><option value="fixed">Fixed</option></select></label>
          <label><input type="checkbox" checked={!!edit.enabled} onChange={(e) => setEdit((v) => ({ ...v, enabled: e.target.checked }))} /> Enabled</label>
          <button className="primary-button">Save Coupon</button>
        </form>
      </>}

      {tab === 'Banners' && <>
        <form className="checkout-form" onSubmit={saveBanner}>
          <h2>Homepage Hero</h2>
          {[['title', 'Title'], ['subtitle', 'Subtitle'], ['eyebrow', 'Eyebrow'], ['image', 'Banner image URL']].map(([k, l]) =>
            <label key={k}>{l}<input value={homepage[k] || ''} onChange={(e) => setHomepage((v: Any) => ({ ...v, [k]: e.target.value }))} /></label>)}
          {uploader('cruvita/banners', 'homepage')}
          <button className="primary-button">Save Homepage</button>
        </form>
        <h2 className="admin-section-title">Additional banners</h2>
        <div className="admin-panel">{items.map((b) => <div className="admin-line" key={b.key}>
          <span>{b.key} — {b.title || '(no title)'}</span>
          <button onClick={async () => { if (confirm('Delete banner?')) { await api('/api/admin/banners', 'DELETE', { key: b.key }); load('Banners'); } }}>Delete</button>
        </div>)}</div>
        <form className="checkout-form" onSubmit={async (e) => { e.preventDefault(); try { await api('/api/admin/banners', 'POST', edit); setEdit({}); report('Banner saved', false); load('Banners'); } catch (err: any) { report(err.message, true); } }}>
          <h3>Add banner</h3>
          {['slug', 'title', 'subtitle', 'image', 'link'].map((k) => field(k))}
          {uploader('cruvita/banners')}
          <button className="primary-button">Save Banner</button>
        </form>
      </>}

      {tab === 'Policies' && <form className="checkout-form" onSubmit={saveSettings}>
        <h2>Policy editor</h2>
        {[
          ['shippingPolicy', 'Shipping policy'], ['refundPolicy', 'Refund policy'],
          ['privacyPolicy', 'Privacy policy'], ['termsPolicy', 'Terms & conditions'],
        ].map(([k, l]) => <label key={k}>{l}<textarea value={settings[k] || ''} onChange={(e) => setSettings((v) => ({ ...v, [k]: e.target.value }))} /></label>)}
        <button className="primary-button">Save Policies</button>
      </form>}

      {tab === 'SEO' && <form className="checkout-form" onSubmit={saveSettings}>
        <h2>SEO & branding</h2>
        {[
          ['storeName', 'Store name'], ['seoTitle', 'Default page title'], ['seoDescription', 'Meta description'],
          ['announcement', 'Announcement bar'], ['logo', 'Logo image URL'],
        ].map(([k, l]) => <label key={k}>{l}<input value={settings[k] || ''} onChange={(e) => setSettings((v) => ({ ...v, [k]: e.target.value }))} /></label>)}
        {uploader('cruvita/logo', 'settings')}
        <button className="primary-button">Save SEO Settings</button>
      </form>}

      {tab === 'Settings' && <form className="checkout-form" onSubmit={saveSettings}>
        <h2>Store settings</h2>
        {[
          ['email', 'Contact email'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp number'], ['address', 'Address'], ['about', 'About text'],
          ['freeShippingThreshold', 'Free shipping above (₹)'], ['flatShippingFee', 'Flat shipping fee (₹)'],
        ].map(([k, l]) => <label key={k}>{l}<textarea value={settings[k] ?? ''} onChange={(e) => setSettings((v) => ({ ...v, [k]: e.target.value }))} /></label>)}
        <label>Homepage testimonials (one approved review per line: Name | Review)
          <textarea value={settings.testimonials ?? ''} onChange={(e) => setSettings((v) => ({ ...v, testimonials: e.target.value }))} />
        </label>
        <button className="primary-button">Save Settings</button>
      </form>}

      {tab === 'Media' && <>
        <p className="muted">Images stored in Cloudinary. Only images no longer referenced by products, categories or content can be removed.</p>
        <div className="admin-panel">{items.map((m) => <div className="admin-line" key={m._id}>
          <span><img src={m.url} alt={m.publicId} style={{ width: 44, height: 44, objectFit: 'cover', verticalAlign: 'middle', marginRight: 8 }} />{m.publicId}</span>
          <button onClick={async () => { if (confirm('Remove this image from Cloudinary?')) { try { await api('/api/admin/media', 'DELETE', { publicId: m.publicId }); report('Image removed', false); load('Media'); } catch (e: any) { report(e.message, true); } } }}>Remove</button>
        </div>)}</div>
      </>}
    </main>
  </div>;
}
