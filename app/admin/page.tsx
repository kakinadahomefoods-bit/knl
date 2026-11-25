'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { storyDefaults } from '@/lib/story';
import { validShortUrl } from '@/lib/short-video';
import './login.css';

type Any = Record<string, any>;
const SECTIONS = [
  'Dashboard', 'Products', 'Categories', 'Inventory', 'Orders', 'Payments',
  'Shipments', 'Coupons', 'Banners', 'Shorts', 'Reels', 'Sections', 'Our Story', 'Policies', 'SEO', 'Settings', 'Media',
];

const MEDIA_FOLDERS = [
  ['cruvita/products', 'Product images'],
  ['cruvita/banners', 'Homepage banners'],
  ['cruvita/shorts', 'Homepage shorts'],
  ['cruvita/categories', 'Category images'],
  ['cruvita/logo', 'Website logo'],
];

export default function Admin() {
  const [logged, setLogged] = useState(false);
  const [checking, setChecking] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('Dashboard');
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [items, setItems] = useState<Any[]>([]);
  const [metrics, setMetrics] = useState<Any>({});
  const [edit, setEdit] = useState<Any>({});
  const [settings, setSettings] = useState<Any>({});
  const [shippingStatus, setShippingStatus] = useState<Any | null>(null);
  const [homepage, setHomepage] = useState<Any>({});
  const [shorts, setShorts] = useState<Any[]>([]);
  const [shortDraft, setShortDraft] = useState<Any>({ url: '', title: '' });
  const [shortEditIndex, setShortEditIndex] = useState<number | null>(null);
  const [story, setStory] = useState<Any>(storyDefaults);
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState('cruvita/products');
  const [uploadTarget, setUploadTarget] = useState<'edit' | 'homepage' | 'settings' | 'short'>('edit');
  const [busy, setBusy] = useState(false);
  const [orderFilter, setOrderFilter] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('adminOrderFilter') || 'All' : 'All'));
  const [orderSearch, setOrderSearch] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('adminOrderSearch') || '' : ''));

  useEffect(() => {
    function closeMenu(event: KeyboardEvent) { if (event.key === 'Escape') setMenuOpen(false); }
    window.addEventListener('keydown', closeMenu);
    return () => window.removeEventListener('keydown', closeMenu);
  }, []);

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
      if (section === 'Products' || section === 'Inventory') {
        const first = await api('/api/products?admin=1&limit=100&page=1');
        const remaining = await Promise.all(
          Array.from({ length: Math.max(0, (first.pages || 1) - 1) }, (_, index) =>
            api(`/api/products?admin=1&limit=100&page=${index + 2}`))
        );
        setItems([...(first.products || []), ...remaining.flatMap((page: Any) => page.products || [])]);
      }
      if (section === 'Categories') setItems((await api('/api/admin/categories')).categories || []);
      if (section === 'Orders') setItems((await api('/api/admin/orders')).orders || []);
      if (section === 'Payments') setItems((await api('/api/admin/payments')).payments || []);
      if (section === 'Shipments') setItems((await api('/api/admin/shipments')).shipments || []);
      if (section === 'Coupons') setItems((await api('/api/admin/coupons')).coupons || []);
      if (section === 'Banners') {
        setItems((await api('/api/admin/banners')).banners || []);
        const content = (await api('/api/content')).content || [];
        setHomepage(content.find((c: Any) => c.key === 'homepage')?.value || {});
      }
      if (section === 'Shorts' || section === 'Reels') {
        const content = (await api('/api/content')).content || [];
        const value = content.find((c: any) => c.key === 'shorts')?.value ?? content.find((c: any) => c.key === 'reels')?.value;
        setShorts(Array.isArray(value) ? value : (Array.isArray(value?.items) ? value.items : []));
      }
      if (section === 'Sections') {
        const content = (await api('/api/content')).content || [];
        const sections = content.find((c: Any) => c.key === 'custom-sections')?.value;
        setItems(Array.isArray(sections) ? sections : []);
      }
      if (section === 'Our Story') {
        const content = (await api('/api/content')).content || [];
        setStory({ ...storyDefaults, ...(content.find((c: Any) => c.key === 'our-story')?.value || {}) });
      }
      if (['Policies', 'SEO', 'Settings'].includes(section)) setSettings((await api('/api/admin/settings')).settings || {});
      if (section === 'Settings') {
        try { setShippingStatus(await api('/api/admin/shipping-status')); } catch { /* diagnostics are optional */ }
      }
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('adminOrderFilter', orderFilter);
      sessionStorage.setItem('adminOrderSearch', orderSearch);
    }
  }, [orderFilter, orderSearch]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/login', 'POST', { email, password });
      setLogged(true); setPassword(''); setMsg(''); load('Dashboard');
    } catch (e: any) { report(e.message, true); }
  }

  function selectTab(s: string) { setTab(s); setEdit({}); setMsg(''); setMenuOpen(false); load(s); }

  async function upload(targetFolder = folder, target: 'edit' | 'homepage' | 'settings' | 'short' = uploadTarget) {
    if (!file) return report(target === 'short' ? 'Choose a video first' : 'Choose an image first', true);
    if (target === 'short') {
      if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 20 * 1024 * 1024 || !file.size) return report('Choose an MP4 or WebM video up to 20 MB.', true);
      setBusy(true);
      try {
        const signed = await api('/api/admin/short-upload', 'POST');
        const form = new FormData();
        form.append('file', file);
        for (const key of ['apiKey', 'timestamp', 'folder', 'signature']) form.append(key === 'apiKey' ? 'api_key' : key, String(signed[key]));
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/video/upload`, { method: 'POST', body: form });
        const result = await response.json();
        if (!response.ok || !result.secure_url || result.resource_type !== 'video') throw new Error(result.error?.message || 'Video upload failed');
        setShortDraft((v: Any) => ({ ...v, url: result.secure_url }));
        setFile(null);
        report('Video uploaded. Select Add Short to publish it.');
      } catch (e: any) { report(e.message || 'Video upload failed', true); } finally { setBusy(false); }
      return;
    }
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
          ...(x.resourceType === 'video' ? { video: x.url, type: 'video', publicId: x.publicId } : {
          images: targetFolder === 'cruvita/products' ? [...(Array.isArray(p.images) ? p.images : String(p.images || '').split(',').map((s: string) => s.trim()).filter(Boolean)), x.url] : p.images,
          image: targetFolder !== 'cruvita/products' ? x.url : p.image,
          logo: targetFolder === 'cruvita/logo' ? x.url : p.logo,
          publicId: targetFolder !== 'cruvita/products' ? x.publicId : p.publicId,
          }),
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
        lengthCm: Number(edit.lengthCm || 20), breadthCm: Number(edit.breadthCm || 15), heightCm: Number(edit.heightCm || 10),
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

  const uploader = (targetFolder = folder, target: 'edit' | 'homepage' | 'settings' | 'short' = 'edit') => <>
    <label className="muted tiny">{target === 'short' ? 'Choose an MP4 or WebM video (max 20 MB)' : `${MEDIA_FOLDERS.find(([v]) => v === targetFolder)?.[1] || 'Image'} — choose an image (max 4 MB)`}</label>
    <input type="file" accept={target === 'short' ? 'video/mp4,video/webm' : (targetFolder === 'cruvita/banners' && target === 'edit' && tab === 'Banners' ? 'image/*,video/mp4,video/webm' : 'image/*')} onChange={(e) => setFile(e.target.files?.[0] || null)} />
    <button type="button" disabled={busy || !file} onClick={() => { setFolder(targetFolder); setUploadTarget(target); upload(targetFolder, target); }}>
      {busy ? 'Uploading…' : target === 'short' ? 'Upload video' : 'Upload image'}
    </button>
  </>;

  const filteredOrders = tab === 'Orders'
    ? items.filter((o: Any) => {
        const q = orderSearch.trim().toLowerCase();
        const matchesSearch = !q || String(o.number || '').toLowerCase().includes(q) || String(o.customer?.name || '').toLowerCase().includes(q) || String(o.customer?.email || '').toLowerCase().includes(q) || String(o.customer?.phone || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
        if (orderFilter === 'All') return true;
        if (orderFilter === 'Pending') return o.paymentStatus === 'pending' || o.paymentStatus === 'failed';
        if (orderFilter === 'Paid') return o.paymentStatus === 'paid' && !['shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(String(o.fulfillmentStatus || ''));
        if (orderFilter === 'Processing') return o.fulfillmentStatus === 'processing';
        if (orderFilter === 'Shipped') return ['shipped', 'out_for_delivery'].includes(String(o.fulfillmentStatus || '')) || !!o.shipment?.awb;
        if (orderFilter === 'Delivered') return o.fulfillmentStatus === 'delivered';
        if (orderFilter === 'Cancelled') return o.fulfillmentStatus === 'cancelled' || o.paymentStatus === 'cancelled';
        return true;
      })
    : items;

  if (checking) return <main className="page-shell prose"><p>Checking session…</p></main>;

  if (!logged) return <main className="admin-login">
    <div className="admin-login-card">
      <div className="admin-login-form-side">
        <Link className="admin-login-brand" href="/" aria-label="Cruvita Cookies storefront">
          <img src="/cruvita-logo-transparent.png" alt="Cruvita Cookies" />
        </Link>
        <div className="admin-login-content">
          <span className="admin-login-eyebrow">CRUVITA COOKIES · STORE ADMIN</span>
          <h1>Welcome <i>back.</i></h1>
          <p className="admin-login-intro">Sign in to manage your store, products and orders.</p>
          {msg && <p role="alert" className="admin-login-error">{msg}</p>}
          <form className="admin-login-form" onSubmit={login}>
            <label htmlFor="admin-email">Email address</label>
            <input id="admin-email" type="email" autoComplete="username" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit">Sign in <span aria-hidden="true">→</span></button>
          </form>
          <Link className="admin-login-back" href="/">← Back to storefront</Link>
        </div>
        <p className="admin-login-footnote">Cruvita Cookies · A little sweetness, every day.</p>
      </div>
      <div className="admin-login-image" aria-hidden="true">
        <div className="admin-login-image-copy"><span>MADE FOR SWEET MOMENTS</span><p>A little bite of <i>happiness.</i></p></div>
      </div>
    </div>
  </main>;

  return <div className="admin">
    <button className="admin-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Admin menu'} <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
    <aside id="admin-navigation" className={`admin-sidebar${menuOpen ? ' admin-sidebar--open' : ''}`}>
      <div className="admin-logo"><img src="/cruvita-logo-transparent.png" alt="Cruvita Cookies" className="admin-sidebar-logo" /><small>STORE ADMIN</small></div>
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
            ['Paid Orders', metrics.paidOrders || 0],
            ['Total Orders', metrics.orders || 0],
            ['Average Order Value', '₹' + Number(metrics.averageOrderValue || 0).toFixed(2)],
            ['Items Sold', metrics.itemsSold || 0],
            ['Pending Payments', metrics.pendingOrders || 0],
            ['Failed Payments', metrics.failedOrders || 0],
            ['Cancelled Orders', metrics.cancelledOrders || 0],
            ['Refunded Orders', metrics.refundedOrders || 0],
            ['Partial Refunds', metrics.partiallyRefundedOrders || 0],
            ['Awaiting Shipment', metrics.unfulfilledPaid || 0],
            ['Products', metrics.products || 0],
          ].map(([a, b]) => <div className="stat" key={String(a)}><span>{a}</span><strong>{b}</strong></div>)}
        </div>
        <div className="admin-panel">
          <div className="admin-line"><strong>Revenue breakdown</strong></div>
          <div className="admin-line"><span>Paid revenue</span><strong>₹{metrics.revenue || 0}</strong></div>
          <div className="admin-line"><span>Shipping collected</span><strong>₹{metrics.shippingRevenue || 0}</strong></div>
          <div className="admin-line"><span>Discounts given</span><strong>₹{metrics.discountTotal || 0}</strong></div>
          <div className="admin-line"><span>Product subtotal</span><strong>₹{metrics.subtotal || 0}</strong></div>
        </div>
        <h2 className="admin-section-title">Payment status</h2>
        <div className="admin-panel">{(metrics.paymentStatus || []).map((r: any) => <div className="admin-line" key={r.status}><span>{r.status}</span><strong>{r.count} orders · ₹{r.total}</strong></div>)}</div>
        <h2 className="admin-section-title">Fulfillment status</h2>
        <div className="admin-panel">{(metrics.fulfillmentStatus || []).map((r: any) => <div className="admin-line" key={r.status}><span>{r.status}</span><strong>{r.count} orders</strong></div>)}</div>
        <h2 className="admin-section-title">Shipping methods</h2>
        <div className="admin-panel">{(metrics.shippingMethods || []).map((r: any) => <div className="admin-line" key={r.method}><span>{r.method}</span><strong>{r.count} orders · ₹{r.shipping}</strong></div>)}</div>
        <h2 className="admin-section-title">Top selling products</h2>
        <div className="admin-panel">{(metrics.topProducts || []).map((r: any, i: number) => <div className="admin-line" key={i}><span>{r.name}</span><strong>{r.qty} sold · ₹{r.revenue}</strong></div>)}</div>
        <h2 className="admin-section-title">Orders (last 14 days)</h2>
        <div className="admin-panel">{(metrics.daily || []).map((r: any) => <div className="admin-line" key={r.date}><span>{r.date}</span><strong>{r.orders} orders · ₹{r.revenue}</strong></div>)}</div>
        <h2 className="admin-section-title">Recent orders</h2>
        <div className="admin-panel">{(metrics.recentOrders || []).map((o: any, i: number) => <div className="admin-line" key={i}><span>{o.number} — {o.customer}{o.city ? ' (' + o.city + ')' : ''}{o.simulation ? ' (SIM)' : ''}</span><strong>₹{o.total} — {o.paymentStatus} / {o.fulfillmentStatus}</strong></div>)}</div>
        <p className="muted">Use the sidebar to manage catalogues, orders, payments and website content. All records shown here come from MongoDB.</p>
      </>
}

      {tab === 'Products' && <>
        <button className="primary-button" onClick={() => { setEdit({ name: '', category: 'Cookies', price: 0, stock: 0, published: true }); setFile(null); }}>+ Add Product</button>
        <div className="admin-panel">{items.map((p) => <div className="admin-line" key={p._id}>
          <span>{p.name} — ₹{p.price} — stock {p.stock} {p.published ? '(Published)' : '(Draft)'}</span>
          <button onClick={() => { setEdit({ ...p }); setFolder('cruvita/products'); }}>Edit</button>
          <button onClick={async () => { if (confirm('Unpublish this product?')) { await api('/api/products/' + p._id, 'DELETE'); load('Products'); } }}>Unpublish</button>
        </div>)}</div>
        {'name' in edit && <form className="checkout-form" onSubmit={saveProduct}>
          <h2>{edit._id ? 'Edit' : 'Add'} Product</h2>
          {['name', 'slug', 'category', 'description', 'price', 'compareAt', 'stock', 'lowStockAt', 'weightGrams', 'lengthCm', 'breadthCm', 'heightCm', 'tags'].map((k) => field(k, k === 'lowStockAt' ? 'Low stock alert at' : k === 'weightGrams' ? 'Weight (grams)' : ['lengthCm', 'breadthCm', 'heightCm'].includes(k) ? k.replace('Cm', '') + ' (cm)' : k, k === 'description' || k === 'tags'))}
          <p className="muted tiny">Weight and dimensions feed the delivery quote and the shipment manifest when a rate fallback is enabled.</p>
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

      {tab === 'Orders' && <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <input placeholder="Search Order ID, customer name or email" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} style={{ maxWidth: 200 }}>
          {['All', 'Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="admin-panel">
        {filteredOrders.length === 0 && <div className="admin-line"><span>No orders match the selected filters.</span></div>}
        {filteredOrders.map((o: Any) => <div className="admin-line" key={o._id}>
        <span>
          <strong>{o.number}</strong> — ₹{o.total} — Payment: {o.paymentStatus} — Status: {o.fulfillmentStatus} — Shipment: {o.shipment?.status || (o.shipment?.awb ? 'created' : 'not created')} — {o.customer?.name} — {o.customer?.phone}
          {o.shipment?.awb ? ` — AWB ${o.shipment.awb}` : ''}{o.shippingMethod ? ` — ${o.shippingMethod} shipping` : ''}{o.simulation ? ' (SIMULATED)' : ''}
        </span>
        <button onClick={() => { if (typeof window !== 'undefined') { sessionStorage.setItem('adminOrderFilter', orderFilter); sessionStorage.setItem('adminOrderSearch', orderSearch); window.location.href = '/admin/orders/' + encodeURIComponent(o._id); } }}>View</button>
        {o.paymentStatus === 'paid' && o.shippingMethod !== 'manual' && !o.shipment?.awb && <button onClick={async () => { try { const x = await api('/api/shipping/create', 'POST', { orderId: o._id, retry: o.shipment?.creationState === 'failed' }); report('Shipment created: ' + x.awb, false); load('Orders'); } catch (e: any) { report(e.message, true); load('Orders'); } }}>{o.shipment?.creationState === 'failed' ? 'Retry shipment' : 'Create shipment'}</button>}
        {o.shipment?.awb && <a className="admin-link-button" href={'/api/shipping/label?orderId=' + encodeURIComponent(o._id)} target="_blank" rel="noopener">Label</a>}
        {o.shipment?.awb && <button onClick={async () => { try { await api('/api/shipping/track?awb=' + encodeURIComponent(o.shipment.awb)); report('Tracking updated', false); load('Orders'); } catch (e: any) { report(e.message, true); } }}>Track</button>}
        {o.shipment?.error && <small className="stat-small">Shipping error: {o.shipment.error}</small>}
        <button onClick={async () => { try { await api('/api/admin/orders/' + o._id + '/reconcile', 'POST'); report('Reconciled', false); load('Orders'); } catch (e: any) { report(e.message, true); } }}>Reconcile</button>
        <button disabled={o.paymentStatus !== 'paid' && o.paymentStatus !== 'partially_refunded'} onClick={async () => {
          const amt = prompt('Refund amount (blank = full)', String(o.total - (o.refundAmount || 0)));
          try { await api('/api/admin/orders/' + o._id + '/refund', 'POST', amt ? { amount: Number(amt) } : {}); report('Refund processed', false); load('Orders'); }
          catch (e: any) { report(e.message, true); }
        }}>Refund</button>
        <button onClick={async () => { const reason = prompt('Cancellation reason (optional)') || ''; try { await api('/api/admin/orders/' + o._id + '/cancel', 'POST', { reason }); report('Order cancelled', false); load('Orders'); } catch (e: any) { report(e.message, true); } }}>Cancel</button>
      </div>)}</div>
      </>}

      {tab === 'Payments' && <div className="admin-panel">{items.map((p) => <div className="admin-line" key={p._id}>
        <span>{p.number} — ₹{p.amount} — {p.status} — {p.simulation ? 'SIMULATED' : p.method || 'gateway'} — {p.razorpayPaymentId || 'awaiting payment'}</span>
      </div>)}</div>}

      {tab === 'Shipments' && <div className="admin-panel">{items.map((s) => <div className="admin-line" key={s._id}>
        <span>
          {s.number} — {s.shipment?.awb ? <>AWB {s.shipment.awb} — {s.shipment.status || 'created'}</> : <>no AWB — {s.shipment?.creationState || 'awaiting payment'}</>}
          {s.shipment?.simulated ? ' (SIMULATED)' : ''} — {s.customer?.name}
          {s.shippingMethod ? <small className="stat-small"> · {s.shippingMethod} shipping · {s.fulfillmentStatus}</small> : null}
          {s.shippingQuote?.parcel?.billableWeightGrams ? <small className="stat-small"> · {s.shippingQuote.parcel.billableWeightGrams} g · {s.shippingQuote.source}</small> : null}
          {s.shipment?.error ? <small className="stat-small"> · {s.shipment.error}</small> : null}
        </span>
        {s.shipment?.awb && <button onClick={async () => { try { await api('/api/shipping/track?awb=' + encodeURIComponent(s.shipment.awb)); report('Tracking updated', false); load('Shipments'); } catch (e: any) { report(e.message, true); } }}>Track</button>}
        {s.shipment?.awb && <a className="admin-link-button" href={'/api/shipping/label?orderId=' + encodeURIComponent(s._id)} target="_blank" rel="noopener">Label</a>}
        {!s.shipment?.awb && s.paymentStatus === 'paid' && s.shippingMethod !== 'manual' && <button onClick={async () => { try { const x = await api('/api/shipping/create', 'POST', { orderId: s._id, retry: s.shipment?.creationState === 'failed' }); report('Shipment created: ' + x.awb, false); load('Shipments'); } catch (e: any) { report(e.message, true); load('Shipments'); } }}>{s.shipment?.creationState === 'failed' ? 'Retry' : 'Create shipment'}</button>}
        {s.shippingMethod === 'manual' && s.paymentStatus === 'paid' && <small className="stat-small">Manual fulfilment — no carrier AWB</small>}
        {s.shipment?.awb && <button onClick={async () => { try { await api('/api/shipping/cancel', 'POST', { orderId: s._id }); report('Shipment cancelled', false); load('Shipments'); } catch (e: any) { report(e.message, true); } }}>Cancel</button>}
      </div>)}</div>}


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
          <button onClick={() => { setEdit({ ...b, slug: b.key.slice('banner:'.length) }); setFile(null); }}>Edit</button>
          <button onClick={async () => { if (confirm('Delete banner?')) { await api('/api/admin/banners', 'DELETE', { key: b.key }); load('Banners'); } }}>Delete</button>
        </div>)}</div>
        <form className="checkout-form" onSubmit={async (e) => { e.preventDefault(); try { await api('/api/admin/banners', 'POST', edit); setEdit({}); report('Banner saved', false); load('Banners'); } catch (err: any) { report(err.message, true); } }}>
          <h3>{edit.key ? 'Edit banner' : 'Add banner'}</h3>
          <label>Slug<input required disabled={!!edit.key} value={edit.slug || ''} onChange={(e) => setEdit((v) => ({ ...v, slug: e.target.value }))} /></label>
          <label>Slide type<select value={edit.type || 'image'} onChange={(e) => setEdit((v) => ({ ...v, type: e.target.value }))}><option value="image">Image</option><option value="video">Video</option></select></label>
          {['title', 'subtitle', 'description', 'ctaText', 'image', 'mobileImage', 'video', 'mobileVideo', 'poster', 'link', 'duration', 'sortOrder'].map((k) => field(k))}
          <p className="muted tiny">Use HTTPS or site-relative URLs. Video slides require a video URL and poster. Duration is in milliseconds (3,000–30,000) for image slides.</p>
          <label><input type="checkbox" checked={!!edit.loop} onChange={(e) => setEdit((v) => ({ ...v, loop: e.target.checked }))} /> Loop video</label>
          <label><input type="checkbox" checked={edit.enabled !== false} onChange={(e) => setEdit((v) => ({ ...v, enabled: e.target.checked }))} /> Enabled</label>
          {uploader('cruvita/banners')}
          <button className="primary-button">Save Banner</button>
          {edit.key && <button type="button" onClick={() => setEdit({})}>Cancel editing</button>}
        </form>
      </>}

      {tab === 'Shorts' || tab === 'Reels' ? <>
        <div className="admin-panel">{shorts.map((s: any, i: number) => <div className="admin-line" key={i}>
          <span>{s?.title || s?.url || s} {s?.url ? <small className="stat-small">{s.url}</small> : null}</span>
          <button type="button" onClick={() => { setShortDraft(typeof s === 'string' ? { url: s, title: '' } : { ...s, url: s.url || s.video || s.src || '' }); setShortEditIndex(i); }}>Edit</button>
          <button type="button" disabled={busy} onClick={async () => { const updated = shorts.filter((_, idx) => idx !== i); try { await api('/api/content', 'PUT', { key: 'shorts', value: updated }); setShorts(updated); setShortEditIndex(null); setShortDraft({ url: '', title: '' }); report('Short removed', false); } catch (e: any) { report(e.message, true); } }}>Remove</button>
        </div>)}</div>
        <form className="checkout-form" onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (!validShortUrl(String(shortDraft.url || '').trim())) return report('Enter an HTTPS video URL or a valid YouTube URL.', true);
          try {
            const item = { ...shortDraft, url: shortDraft.url.trim(), title: shortDraft.title || '' };
            const updated = shortEditIndex === null ? [...shorts, item] : shorts.map((s, i) => i === shortEditIndex ? item : s);
            await api('/api/content', 'PUT', { key: 'shorts', value: updated });
            setShorts(updated); setShortDraft({ url: '', title: '' }); setShortEditIndex(null); report('Short saved', false);
          } catch (err: any) { report(err.message, true); }
        }}>
          <h2>{shortEditIndex === null ? 'Add short video' : 'Edit short video'}</h2>
          <label>Video URL<input required value={shortDraft.url || ''} onChange={(e) => setShortDraft((v: any) => ({ ...v, url: e.target.value }))} /></label>
          <label>Title<input value={shortDraft.title || ''} onChange={(e) => setShortDraft((v: any) => ({ ...v, title: e.target.value }))} /></label>
          {uploader('cruvita/shorts', 'short')}
          <button className="primary-button" type="submit" disabled={busy}>{shortEditIndex === null ? 'Add Short' : 'Save Short'}</button>
          {shortEditIndex !== null && <button type="button" onClick={() => { setShortEditIndex(null); setShortDraft({ url: '', title: '' }); }}>Cancel</button>}
        </form>
        <button className="outline-button" onClick={async () => {
          try { await api('/api/content', 'PUT', { key: 'shorts', value: shorts }); report('Shorts saved', false); }
          catch (e: any) { report(e.message, true); }
        }}>Save list</button>
      </> : null}
      {tab === 'Sections' && <>
        <p className="muted">Create custom homepage sections with text and an optional image. Sections appear in the order shown below.</p>
        <button className="primary-button" onClick={() => { setEdit({ id: crypto.randomUUID(), title: '', enabled: true, sortOrder: items.length }); setFile(null); }}>+ Add Section</button>
        <div className="admin-panel">{items.map((s) => <div className="admin-line" key={s.id}>
          <span>{s.title} {s.enabled === false ? '— hidden' : ''}</span>
          <button onClick={() => { setEdit({ ...s }); setFile(null); }}>Edit</button>
          <button onClick={async () => { if (!confirm('Delete this section?')) return; try { await api('/api/content', 'PUT', { key: 'custom-sections', value: items.filter((item) => item.id !== s.id) }); report('Section deleted'); load('Sections'); } catch (e: any) { report(e.message, true); } }}>Delete</button>
        </div>)}</div>
        {edit.id && <form className="checkout-form" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const section = { ...edit, sortOrder: Number(edit.sortOrder) || 0 };
            const updated = [...items.filter((item) => item.id !== edit.id), section].sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
            await api('/api/content', 'PUT', { key: 'custom-sections', value: updated });
            setEdit({}); report('Section saved'); load('Sections');
          } catch (err: any) { report(err.message, true); }
        }}>
          <h2>Section details</h2>
          <label>Title<input required value={edit.title || ''} onChange={(e) => setEdit((v) => ({ ...v, title: e.target.value }))} /></label>
          {field('eyebrow', 'Small heading')}
          {field('description', 'Description', true)}
          {field('image', 'Image URL')}
          {field('sortOrder', 'Display order')}
          <label><input type="checkbox" checked={edit.enabled !== false} onChange={(e) => setEdit((v) => ({ ...v, enabled: e.target.checked }))} /> Published</label>
          {uploader('cruvita/banners')}
          <button className="primary-button">Save Section</button>
          <button type="button" onClick={() => setEdit({})}>Cancel</button>
        </form>}
      </>}

      {tab === 'Our Story' && <form className="checkout-form" onSubmit={async (e) => {
        e.preventDefault();
        try { await api('/api/content', 'PUT', { key: 'our-story', value: story }); report('Our Story saved'); }
        catch (err: any) { report(err.message, true); }
      }}>
        <p className="muted">Edit the Our Story page. Images can be uploaded from your device or entered as URLs. Use internal paths such as /shop for links.</p>
        {[
          ['Hero', ['heroEyebrow', 'heroHeading', 'heroDescription', 'heroImage']],
          ['Heart of Cruvita', ['showHeart', 'heartHeading', 'heartDescription', 'heartImage', 'detailImage']],
          ['Philosophy', ['showPhilosophy', 'philosophyHeading', 'card1Title', 'card1Description', 'card1Image', 'card2Title', 'card2Description', 'card2Image', 'card3Title', 'card3Description', 'card3Image']],
          ['Lifestyle', ['showLifestyle', 'lifestyleHeading', 'lifestyleDescription', 'lifestyleImage', 'lifestyleButton', 'lifestyleLink']],
          ['Collection', ['showCollection', 'collectionHeading', 'collectionDescription', 'collectionButton', 'collectionLink']],
          ['Quote', ['showQuote', 'quote', 'quoteDescription']],
          ['Final call to action', ['showFinal', 'finalEyebrow', 'finalHeading', 'finalDescription', 'finalImage', 'finalButton', 'finalLink', 'contactButton', 'contactLink']],
        ].map(([heading, keys]) => <fieldset key={heading as string} style={{ border: '1px solid #ecd9ca', borderRadius: 12, padding: 18, margin: '15px 0' }}>
          <legend>{heading as string}</legend>
          {(keys as string[]).map((key) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
            if (key.startsWith('show')) return <label key={key}><input type="checkbox" checked={story[key] !== false} onChange={(e) => setStory((v) => ({ ...v, [key]: e.target.checked }))} /> Show section</label>;
            return <div key={key}>
              <label>{label}{key.toLowerCase().includes('description')
                ? <textarea value={story[key] || ''} onChange={(e) => setStory((v) => ({ ...v, [key]: e.target.value }))} />
                : <input value={story[key] || ''} onChange={(e) => setStory((v) => ({ ...v, [key]: e.target.value }))} />}</label>
              {key.endsWith('Image') && <input type="file" accept="image/*" aria-label={'Upload ' + label} disabled={busy} onChange={async (e) => {
                const selected = e.target.files?.[0];
                if (!selected) return;
                setBusy(true);
                try {
                  const form = new FormData(); form.append('file', selected); form.append('folder', 'cruvita/banners');
                  const response = await fetch('/api/upload', { method: 'POST', body: form });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error || 'Upload failed');
                  setStory((v) => ({ ...v, [key]: result.url })); report('Image uploaded. Save Our Story to publish it.');
                } catch (err: any) { report(err.message, true); } finally { setBusy(false); }
              }} />}
            </div>;
          })}
        </fieldset>)}
        <button className="primary-button" disabled={busy}>Save Our Story</button>
      </form>}

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
          ['announcement', 'Announcement bar'], ['logo', 'Desktop logo image URL'], ['mobileLogo', 'Mobile logo image URL (optional)'],
        ].map(([k, l]) => <label key={k}>{l}<input value={settings[k] || ''} onChange={(e) => setSettings((v) => ({ ...v, [k]: e.target.value }))} /></label>)}
        {uploader('cruvita/logo', 'settings')}
        <button className="primary-button">Save SEO Settings</button>
      </form>}

      {tab === 'Settings' && <form className="checkout-form" onSubmit={saveSettings}>
        <h2>Store settings</h2>
        {[
          ['email', 'Contact email'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp number'], ['address', 'Address'], ['fssaiLicense', 'FSSAI licence number'], ['about', 'About text'],
          ['flatShippingFee', 'Flat shipping fee (₹)'],
        ].map(([k, l]) => <label key={k}>{l}<textarea value={settings[k] ?? ''} onChange={(e) => setSettings((v) => ({ ...v, [k]: e.target.value }))} /></label>)}
        <p className="muted tiny">These two shipping values are used by both the storefront estimate and the server-side total. No shipping price is invented: the selected method below supplies the charge.</p>
        <h3>Shipping methods</h3>
        <label><input type="checkbox" checked={settings.delhiveryEnabled === true || settings.delhiveryEnabled === 'true'}
          onChange={(e) => setSettings((v) => ({ ...v, delhiveryEnabled: e.target.checked }))} /> Enable Delhivery courier booking</label>
        <label>Approved fallback shipping method
          <select value={settings.fallbackShippingMethod || 'none'}
            onChange={(e) => setSettings((v) => ({ ...v, fallbackShippingMethod: e.target.value }))}>
            <option value="none">None — block checkout when the carrier is unavailable</option>
            <option value="flat_fee">Flat delivery fee (configured above) — manual fulfilment</option>
            <option value="rate_card">Weight/PIN rate card (approved) — manual fulfilment</option>
          </select>
        </label>
        {shippingStatus && <p className="muted tiny">
          Server check — Delhivery credentials: {shippingStatus.delhivery?.credentialsConfiguredOnServer ? 'present' : 'missing'} ·
          Live carrier: {shippingStatus.delhivery?.live ? 'enabled' : 'off'} ·
          Pickup configured: {shippingStatus.delhivery?.pickupPinConfigured ? 'yes' : 'no'} ·
          Razorpay: {shippingStatus.payments?.razorpayConfigured ? 'configured' : 'missing'}
        </p>}
        <p className="muted tiny">When Delhivery is off or unavailable, the approved fallback is used, the charge is shown before payment, and the order is marked for manual shipment processing. No automatic carrier shipment is attempted.</p>
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
