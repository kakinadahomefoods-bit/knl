'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import StoryPage from './StoryPage';
import ContactPage from '@/components/ContactPage';
import StoreBenefits from '@/components/StoreBenefits';
import { BUSINESS_DEFAULTS } from '@/lib/business';
import HeroCarousel from '@/components/HeroCarousel';
import CatalogueImage from '@/components/CatalogueImage';
import { validateCustomer } from '@/lib/validation';
import {
  ShoppingBag, Search, Heart, Menu, X, Minus, Plus, Trash2, ArrowRight, Truck,
  ShieldCheck, Mail, Phone, Copy, Check, Package, AlertTriangle, MapPin,
  SlidersHorizontal, ChevronRight,
} from 'lucide-react';

type P = {
  _id: string; name: string; slug: string; category: string; description?: string;
  price: number; compareAt?: number; stock: number; images: string[];
  featured?: boolean; tags?: string[]; variants?: any[];
};
type Cat = { _id: string; name: string; slug: string; image?: string; description?: string };
type Cart = { id: string; qty: number };
type PageKey = 'home' | 'shop' | 'product' | 'cart' | 'wishlist' | 'checkout' |
  'success' | 'track' | 'about' | 'contact' | 'policies' | 'simulation';

const PATHS: Record<PageKey, string> = {
  home: '/', shop: '/shop', product: '/product', cart: '/cart', wishlist: '/wishlist',
  checkout: '/checkout', success: '/order/success', track: '/track', about: '/about',
  contact: '/contact', policies: '/policies', simulation: '/checkout',
};

function readPath(pathname: string): { page: PageKey; slug?: string; policy?: string } {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/product/')) return { page: 'product', slug: decodeURIComponent(p.slice(9)) };
  if (p.startsWith('/policies/')) return { page: 'policies', policy: decodeURIComponent(p.slice(10)) };
  const byPath: Record<string, PageKey> = {
    '/': 'home', '/shop': 'shop', '/cart': 'cart', '/wishlist': 'wishlist',
    '/checkout': 'checkout', '/order/success': 'success', '/track': 'track',
    '/about': 'about', '/contact': 'contact', '/policies': 'policies',
  };
  return { page: byPath[p] || 'home' };
}

const POLICIES = [
  { key: 'shipping', label: 'Shipping Policy', field: 'shippingPolicy' },
  { key: 'refund', label: 'Refund Policy', field: 'refundPolicy' },
  { key: 'privacy', label: 'Privacy Policy', field: 'privacyPolicy' },
  { key: 'terms', label: 'Terms & Conditions', field: 'termsPolicy' },
];

export default function LiveStore({ initialPage = 'home', initialSlug, initialPolicy }: {
  initialPage?: PageKey; initialSlug?: string; initialPolicy?: string;
}) {
  const [page, setPage] = useState<PageKey>(initialPage);
  const [products, setProducts] = useState<P[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [homepage, setHomepage] = useState<any>({});
  const [banners, setBanners] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [heroSlidesState, setHeroSlidesState] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState('');
  const [menu, setMenu] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('new');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selected, setSelected] = useState<P | null>(null);
  const [gallery, setGallery] = useState(0);
  const [policy, setPolicy] = useState(initialPolicy || 'shipping');
  const [cart, setCart] = useState<Cart[]>([]);
  const [coupon, setCoupon] = useState(''); // applied coupon code (server-validated only)
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [buyNowItems, setBuyNowItems] = useState<Cart[] | null>(null);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', houseNo: '', street: '', landmark: '', city: '', state: '', pin: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'info' | 'error' | 'success'>('info');
  const [order, setOrder] = useState<{ number: string; token: string; simulation?: boolean } | null>(null);
  const [sim, setSim] = useState<{ orderId: string; razorpayOrderId: string; amount: number } | null>(null);
  const [track, setTrack] = useState({ number: '', token: '' });
  const [tracking, setTracking] = useState<any>(null);
  const [orderTracking, setOrderTracking] = useState<any>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<any>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [paymentAvailable, setPaymentAvailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const idem = useRef('');
  const quoteSeq = useRef(0);

  const email = settings.email || BUSINESS_DEFAULTS.email;
  const phone = settings.phone || BUSINESS_DEFAULTS.phone;
  const address = settings.address || BUSINESS_DEFAULTS.address;
  const fssaiLicense = settings.fssaiLicense || BUSINESS_DEFAULTS.fssaiLicense;
  const whatsappDigits = String(settings.whatsapp || phone).replace(/\D/g, '');
  const whatsappNumber = whatsappDigits.length === 10 ? '91' + whatsappDigits : whatsappDigits;
  const whatsappUrl = whatsappNumber ? 'https://wa.me/' + whatsappNumber : 'https://wa.me/';

  function notice(text: string, kind: 'info' | 'error' | 'success' = 'info') {
    setMessage(text);
    setMessageKind(kind);
  }

  // Initial data + URL synchronisation.
  useEffect(() => {
    fetch('/api/checkout/config').then((r) => r.json()).then((x) => setPaymentAvailable(x.available === true)).catch(() => setPaymentAvailable(false));
  }, []);

  useEffect(() => {
    const initial = readPath(window.location.pathname);
    setPage(initial.page);
    if (initial.slug) setPolicyOrProduct(initial.slug);
    if (initial.policy) setPolicy(initial.policy);

    try {
      setCart(JSON.parse(localStorage.getItem('cruvita-cart') || '[]'));
    } catch { /* ignore corrupt local storage */ }

    async function loadProducts() {
      const getPage = async (page: number) => {
        const response = await fetch(`/api/products?limit=100&page=${page}`);
        if (!response.ok) throw new Error('Products unavailable');
        return response.json();
      };
      const first = await getPage(1);
      setProducts(first.products || []);
      setCategories(first.categories || []);
      setLoading(false);
      const remaining = await Promise.all(
        Array.from({ length: Math.max(0, (first.pages || 1) - 1) }, (_, index) => getPage(index + 2))
      );
      setProducts([...(first.products || []), ...remaining.flatMap((result) => result.products || [])]);
    }
    loadProducts()
      .catch(() => setCatalogueError('Products are temporarily unavailable. Please refresh the page to try again.'))
      .finally(() => setLoading(false));

    fetch('/api/content')
      .then((r) => r.json())
      .then((x) => {
        const list: any[] = x.content || [];
        setContent(list);
        const s = list.find((c) => c.key === 'settings')?.value;
        if (s) setSettings(s);
        const homepageValue = list.find((c) => c.key === 'homepage')?.value || {};
        const bannerSlides = list.filter((c) => String(c.key).startsWith('banner:')).map((c) => c.value).filter(Boolean);
        setHomepage(homepageValue);
        setBanners(bannerSlides);
        const shortsValue = list.find((c) => c.key === 'shorts')?.value
          ?? list.find((c) => c.key === 'reels')?.value
          ?? homepageValue.shorts ?? homepageValue.reels;
        setShorts(Array.isArray(shortsValue) ? shortsValue
          : (Array.isArray(shortsValue?.items) ? shortsValue.items : []));
        const configuredSlides = Array.isArray(homepageValue.slides) && homepageValue.slides.length
          ? homepageValue.slides
          : bannerSlides.filter((b) => b?.enabled !== false).sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0));
        if (configuredSlides.length) {
          const hasExplicitSlides = Array.isArray(homepageValue.slides) && homepageValue.slides.length > 0;
          const defaultVideos = [
            { type: 'video', video: '/WhatsApp Video 2026-11-19 at 12.45.23 AM.mp4', poster: '/Hero_Banner.webp' },
            { type: 'video', video: '/WhatsApp Video 2026-11-19 at 12.45.26 AM.mp4', poster: '/Hero_Banner.webp' },
          ];
          setHeroSlidesState(!hasExplicitSlides && !configuredSlides.some((slide: any) => slide.type === 'video')
            ? [...defaultVideos, ...configuredSlides] : configuredSlides);
        }
      })
      .catch(() => { /* content is optional */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setPolicyOrProduct(slug: string) {
    try {
      const r = await fetch('/api/products/' + encodeURIComponent(slug));
      const x = await r.json();
      if (r.ok && x.product) {
        setSelected(x.product);
        setGallery(0);
      }
    } catch { /* product may have been unpublished */ }
  }

  useEffect(() => {
    const handler = () => {
      const p = readPath(window.location.pathname);
      setPage(p.page);
      if (p.slug) setPolicyOrProduct(p.slug);
      if (p.policy) setPolicy(p.policy);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setMenu(false); setFiltersOpen(false); }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => { localStorage.setItem('cruvita-cart', JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    const titles: Partial<Record<PageKey, string>> = {
      home: 'Baked with Love', shop: 'Shop All Treats', product: selected?.name || 'Product',
      cart: 'Your Bag', wishlist: 'Wishlist', checkout: 'Guest Checkout', success: 'Order Confirmed',
      about: 'Our Story', contact: 'Contact Us', policies: 'Store Policies',
    };
    document.title = page === 'about' ? 'Our Story | Cruvita Cookies' : (settings.storeName || 'Cruvita Cookies') + ' | ' + (titles[page] || 'Baked with Love');
  }, [page, selected, settings.storeName]);

  function navigate(to: PageKey, opts?: { slug?: string; policy?: string }) {
    let path = PATHS[to];
    if (to === 'product' && opts?.slug) path = '/product/' + encodeURIComponent(opts.slug);
    if (to === 'policies' && opts?.policy) path = '/policies/' + encodeURIComponent(opts.policy);
    window.history.pushState({}, '', path);
    setPage(to);
    if (opts?.policy) setPolicy(opts.policy);
    setMenu(false);
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openProduct(p: P) {
    setSelected(p);
    setGallery(0);
    navigate('product', { slug: p.slug });
  }

  function shopCategory(nextCategory: string) {
    setSearch('');
    setMinPrice('');
    setMaxPrice('');
    setCategory(nextCategory);
    navigate('shop');
  }

  function add(id: string, qty = 1) {
    setCart((c) => {
      const existing = c.find((i) => i.id === id);
      return existing
        ? c.map((i) => (i.id === id ? { ...i, qty: Math.min(20, i.qty + qty) } : i))
        : [...c, { id, qty }];
    });
    notice('Added to your bag', 'success');
  }

  function changeQty(id: string, delta: number) {
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }

  /** Buy Now checks out only the selected product — unrelated cart items are untouched
   *  and are never included in this order. */
  function buyNow(id: string, qty = 1) {
    setBuyNowItems([{ id, qty }]);
    setCoupon('');
    setCouponInput('');
    setCouponError('');
    idem.current = '';
    navigate('checkout');
  }

  function continueFromCart() {
    setBuyNowItems(null);
    navigate('checkout');
  }

  // Every category is available inside Shop All — there are no separate category pages.
  const DEFAULT_CATEGORIES = ['Cookies', 'Brownies', 'Gift Boxes', 'Bestsellers'];
  const categoriesForNav = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...categories.map((c) => c.name)])
  );
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) =>
      (category === 'All' || p.category.toLowerCase().trim() === category.toLowerCase().trim() ||
        (category === 'Bestsellers' && (p.featured || (p.tags || []).some((t) => /bestseller/i.test(t))))) &&
      (!q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) &&
      (!minPrice || p.price >= Number(minPrice)) &&
      (!maxPrice || p.price <= Number(maxPrice))
    );
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, category, search, sort, minPrice, maxPrice]);

  const entries = cart.map((i) => ({ p: products.find((x) => x._id === i.id), qty: i.qty }))
    .filter((x): x is { p: P; qty: number } => Boolean(x.p));
  // Buy Now uses an isolated item list so other products in the bag are never purchased.
  const checkoutItems = buyNowItems ?? cart;
  const checkoutEntries = checkoutItems.map((i) => ({ p: products.find((x) => x._id === i.id), qty: i.qty }))
    .filter((x): x is { p: P; qty: number } => Boolean(x.p));
  const subtotal = entries.reduce((a, x) => a + x.p.price * x.qty, 0);
  // Bill values prefer the authoritative server quote; tax is included in MRP.
  const quoteKey = JSON.stringify([customer.pin, customer.city, customer.state, customer.houseNo, customer.street, customer.landmark, checkoutItems]);
  const activeQuote = deliveryQuote?.key === quoteKey ? deliveryQuote : null;
  const bill = activeQuote?.pricing;
  const billSubtotal = bill ? Number(bill.subtotal) : checkoutEntries.reduce((a, x) => a + x.p.price * x.qty, 0);
  const billDiscount = bill ? Number(bill.discount) : 0;
  const billShipping = bill ? Number(bill.shipping) : null;
  const billTotal = bill ? Number(bill.total) : billSubtotal;
  const canPay = !busy && !quoteBusy && coupon === couponInput.trim().toUpperCase() && paymentAvailable && checkoutEntries.length > 0 && Boolean(activeQuote?.ok && bill && Number.isFinite(billShipping) && Number.isFinite(billTotal)) && !validateCustomer(customer);

  const cartCount = cart.reduce((s, x) => s + x.qty, 0);
  const testimonials = typeof settings.testimonials === 'string'
    ? settings.testimonials.split('\n').map((line: string) => {
        const separator = line.indexOf('|');
        return separator < 0 ? null : { name: line.slice(0, separator).trim(), text: line.slice(separator + 1).trim() };
      }).filter((review: { name: string; text: string } | null): review is { name: string; text: string } => Boolean(review?.name && review.text))
    : [];
  const optimizedBanner = (url: string) => ({
    '/Hero_Banner.png': '/Hero_Banner.webp',
    '/Cookies_Brownies_Banner.png': '/Cookies_Brownies_Banner.webp',
    '/Gift_Boxes_Banner.png': '/Gift_Boxes_Banner.webp',
  } as Record<string, string>)[url] || url;
  const sortedBanners = [...banners].filter((b) => b?.enabled !== false && b?.type === 'video').sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0));
  const videoSlides = heroSlidesState.filter((slide) => slide.type === 'video' && slide.video);
  const heroSlides = videoSlides.length
    ? videoSlides
    : [
        { type: 'video', video: '/WhatsApp Video 2026-11-19 at 12.45.23 AM.mp4', poster: '/Hero_Banner.webp', title: homepage.title || 'A little bite of', subtitle: homepage.subtitle || 'happiness.' },
        { type: 'video', video: '/WhatsApp Video 2026-11-19 at 12.45.26 AM.mp4', poster: '/Hero_Banner.webp', title: homepage.title || 'A little bite of', subtitle: homepage.subtitle || 'happiness.' },
      ];

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!checkoutEntries.length) return notice('Your bag is empty', 'error');
    // Never reach the payment gateway until shipping has been resolved server-side.
    if (!canPay || !activeQuote?.ok || !/^[1-9]\d{5}$/.test(String(customer.pin || '').trim())) {
      return notice(deliveryQuote?.error || quoteError || 'Please enter a valid PIN code and wait for delivery charges to be calculated.', 'error');
    }
    if (!idem.current) idem.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': idem.current },
        // The backend recalculates every amount from these values; the client total is never trusted.
        body: JSON.stringify({ customer, items: checkoutItems, coupon }),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'Checkout unavailable');

      if (x.simulation) {
        setSim({ orderId: x.orderId, razorpayOrderId: x.razorpayOrderId, amount: x.amount });
        navigate('simulation');
        return;
      }

      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Payment widget unavailable'));
          document.body.appendChild(s);
        });
      }
      const instance = new (window as any).Razorpay({
        key: x.key, amount: x.amount, currency: 'INR', name: settings.storeName || 'Cruvita Cookies',
        description: 'Cookie order ' + x.number, order_id: x.razorpayOrderId,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        theme: { color: '#a54c40' },
        handler: async (response: any) => {
          try {
            const v = await fetch('/api/payments/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response),
            });
            const result = await v.json();
            if (!v.ok) return notice(result.error || 'Payment verification pending', 'error');
            if (result.status !== 'captured') return notice('Payment is authorized but capture is pending. Please contact us before trying again.', 'error');
            setOrder({ number: result.number, token: result.trackingToken });
            setCart([]); setBuyNowItems(null); idem.current = '';
            navigate('success');
          } catch {
            notice('Payment verification is pending. Please contact us before trying again.', 'error');
          }
        },
      });
      instance.on('payment.failed', () => notice('Payment failed. Please try again.', 'error'));
      instance.open();
    } catch (e: any) {
      notice(e.message || 'Checkout unavailable', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSimulation() {
    if (!sim) return;
    setBusy(true);
    try {
      const r = await fetch('/api/payments/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpayOrderId: sim.razorpayOrderId }),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'Simulation failed');
      setOrder({ number: x.number, token: x.trackingToken, simulation: true });
      setCart([]); setBuyNowItems(null); idem.current = '';
      navigate('success');
    } catch (e: any) {
      notice(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function findOrder(e: React.FormEvent) {
    e.preventDefault();
    setTracking(null);
    const r = await fetch('/api/track?number=' + encodeURIComponent(track.number) + '&token=' + encodeURIComponent(track.token));
    const x = await r.json();
    setTracking(r.ok ? x : { error: x.error || 'Order not found' });
  }

  /** Live server quote — the exact same code path checkout uses to charge the customer. */
  async function refreshQuote(
    pin = String(customer.pin || '').trim(),
    items = checkoutItems,
    couponCode = coupon
  ) {
    const seq = ++quoteSeq.current;
    const requestKey = quoteKey;
    setDeliveryQuote(null);
    if (!/^[1-9]\d{5}$/.test(pin) || !items.length) {
      setQuoteBusy(false);
      setQuoteError('Please enter a valid PIN code.');
      return;
    }
    setQuoteBusy(true);
    try {
      const r = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, items, coupon: couponCode }),
      });
      const x = await r.json();
      if (seq !== quoteSeq.current) return;
      if (!r.ok || !x.ok) {
        if (x.errorCode === 'COUPON_INVALID') {
          // Keep delivery usable: drop the rejected coupon and recalculate without it.
          setCouponError(x.error || 'This coupon cannot be applied to your order.');
          setCoupon('');
          return void refreshQuote(pin, items, '');
        }
        setCouponError('');
        setDeliveryQuote(null);
        setQuoteError(x.error || 'Unable to calculate delivery charges');
      } else {
        setDeliveryQuote({ ...x, key: requestKey });
        setCoupon(couponCode);
        setQuoteError('');
      }
    } catch {
      if (seq !== quoteSeq.current) return;
      setDeliveryQuote(null);
      setQuoteError('Unable to calculate delivery charges right now. Please try again.');
    } finally {
      if (seq === quoteSeq.current) setQuoteBusy(false);
    }
  }

  // Any change to the delivery destination or cart invalidates an outstanding quote.
  useEffect(() => {
    quoteSeq.current += 1;
    setDeliveryQuote(null);
    setQuoteBusy(false);
    setQuoteError('');
    idem.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (page !== 'checkout' || !/^[1-9]\d{5}$/.test(customer.pin) || !customer.houseNo.trim() || !customer.street.trim() || !customer.city.trim() || !customer.state.trim() || !checkoutItems.length) return;
    const timer = window.setTimeout(() => {
      void refreshQuote(customer.pin.trim(), checkoutItems, couponInput.trim().toUpperCase());
    }, 600);
    return () => window.clearTimeout(timer);
  }, [quoteKey, page, couponInput]);

  // Show the latest shipment status on the confirmation page.
  useEffect(() => {
    if (page !== 'success' || !order?.number || !order?.token) return;
    let cancelled = false;
    fetch('/api/track?number=' + encodeURIComponent(order.number) + '&token=' + encodeURIComponent(order.token))
      .then((r) => r.json())
      .then((x) => { if (!cancelled) setOrderTracking(x); })
      .catch(() => { if (!cancelled) setOrderTracking({ error: 'Tracking temporarily unavailable' }); });
    return () => { cancelled = true; };
  }, [page, order]);

  function trackingView(data: any) {
    if (!data) return null;
    if (data.error) return <p className="muted tiny pin-error" role="alert">{data.error}</p>;
    const shipment = data.order?.shipment;
    const t = data.tracking;
    if (!shipment?.awb) return <p className="muted tiny">Shipment details will appear here once your order is packed.</p>;
    return <div className="tracking-card">
      <h3>Shipment tracking</h3>
      <p><strong>AWB:</strong> {shipment.awb}{shipment.simulated ? <span className="sim-label"> (SIMULATED)</span> : ''}</p>
      {t?.status && <p><strong>Status:</strong> {t.description || t.status}</p>}
      {t?.expected && <p><strong>Expected:</strong> {t.expected}</p>}
      {Array.isArray(t?.timeline) && t.timeline.length > 0 && <ol className="tracking-timeline">
        {t.timeline.map((event: any, i: number) => <li key={i}>
          <strong>{event.status}</strong>{event.location ? ` — ${event.location}` : ''}
          {event.at ? <small> {String(event.at).slice(0, 24)}</small> : null}
        </li>)}
      </ol>}
      {data.shipmentTracking?.error && <p className="muted tiny">{data.shipmentTracking.error}</p>}
      {!t && <p className="muted tiny">Live tracking is temporarily unavailable. Please check back soon.</p>}
    </div>;
  }

  function tile(p: P, index = 0) {
    return (
      <article className="product-card" key={p._id}
        onMouseMove={(e) => {
          const el = e.currentTarget;
          const r = el.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          el.style.setProperty('--rx', (((y / r.height) - 0.5) * -12).toFixed(2) + 'deg');
          el.style.setProperty('--ry', (((x / r.width) - 0.5) * 12).toFixed(2) + 'deg');
          el.style.setProperty('--mx', x + 'px');
          el.style.setProperty('--my', y + 'px');
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        }}>
        <button className="product-photo" onClick={() => openProduct(p)}>
          {p.images?.[0] ? <CatalogueImage key={p.images[0]} src={p.images[0]} alt={p.name} eager={page === 'shop' && index < 4} />
            : <span>{p.category === 'Brownies' ? '🍫' : p.category === 'Gift Boxes' ? '🎁' : '🍪'}</span>}
          {p.tags?.[0] && <small>{p.tags[0]}</small>}
        </button>
        <div className="product-info">
          <div className="muted tiny">{p.category}</div>
          <button className="product-title" onClick={() => openProduct(p)}>{p.name}</button>
          <div className="price">₹{p.price} {p.compareAt && <del>₹{p.compareAt}</del>}</div>
          {!!p.variants?.length && <div className="muted tiny">Options: {p.variants.map((variant: any) => variant.name).filter(Boolean).join(', ')}</div>}
          <button className="outline-button" onClick={() => add(p._id)}>
            Add to Bag +
          </button>
          <button className="primary-button product-buy-now" onClick={() => buyNow(p._id)}>Buy Now</button>
        </div>
      </article>
    );
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: settings.storeName || BUSINESS_DEFAULTS.name,
      email,
      telephone: phone,
      address,
    }).replace(/</g, '\\u003c') }} />
    <div className="announcement">{settings.announcement || 'Sweet moments, freshly baked • Cruvita Cookies'}</div>
    <header className="header">
      <div className="navwrap">
        <button className="mobile-only iconbtn" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="store-navigation">{menu ? <X /> : <Menu />}</button>
        <button className="brand" onClick={() => navigate('home')}>
          <picture>
            {settings.mobileLogo && <source media="(max-width: 700px)" srcSet={settings.mobileLogo} />}
            <img src={settings.logo || '/cruvita-logo-transparent.png'} alt="Cruvita Cookies" className="header-logo" />
          </picture>
        </button>
        <nav id="store-navigation" className={menu ? 'nav open' : 'nav'} aria-label="Main navigation">
          <button onClick={() => navigate('home')}>Home</button>
          <button onClick={() => shopCategory('All')}>Shop All</button>
          {categoriesForNav.filter((c) => !['Cookies', 'Brownies', 'Gift Boxes', 'Bestsellers'].includes(c)).map((c) => <button key={c} onClick={() => shopCategory(c)}>{c}</button>)}
          <button onClick={() => navigate('about')}>Our Story</button>
          <button onClick={() => navigate('contact')}>Contact</button>
        </nav>
        <div className="nav-actions">
          <button className="iconbtn" aria-label="Search products" onClick={() => { setFiltersOpen(true); navigate('shop'); }}><Search /></button>
          <button className="iconbtn bag" aria-label="Shopping bag" onClick={() => navigate('cart')}>
            <ShoppingBag />{cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
      </div>
    </header>

    {message && <div className={'notice ' + (messageKind === 'error' ? 'notice-error' : messageKind === 'success' ? 'notice-success' : '')} role="status">{message}</div>}

    {page === 'home' && <>
      <HeroCarousel slides={heroSlides} eyebrow={homepage.eyebrow || 'FRESHLY BAKED JOY'} description={settings.about || 'Delightful cookies, rich brownies and beautiful gift boxes, made for life’s sweetest moments.'} onShop={() => shopCategory('All')} />
      <StoreBenefits fssaiLicense={fssaiLicense} />
      <section className="section">
        <div className="section-heading section-heading-centered"><div className="eyebrow">EXPLORE OUR COLLECTIONS</div><h2>Shop by <i>Category</i></h2></div>
        <div className="category-grid">
          {categories.filter((c) => ['cookies', 'brownies', 'gift boxes'].includes(c.name.toLowerCase().trim())).map((cat) => {
            const c = cat.name;
            return <button className="category-card" key={c} onClick={() => shopCategory(c)}>
              <div className="category-card-media">
                {cat.image ? <CatalogueImage key={cat.image} src={cat.image} alt="" category />
                  : <span className="category-monogram" aria-hidden="true">{c.charAt(0)}</span>}
              </div>
              <div className="category-card-copy"><h3>{c}</h3><b>Shop Now →</b></div>
            </button>;
          })}
        </div>
      </section>

      <section className="section tinted">
        <div className="section-heading section-heading-centered"><div className="eyebrow">CUSTOMER FAVORITES</div><h2>Our Sweet <i>Bestsellers</i></h2></div>
        {loading ? <p className="center">Loading treats…</p> : (
          <>
            <div className="product-grid">
              {products.filter((p) => p.category === 'Bestsellers' || p.featured || (p.tags || []).some((t) => /bestseller/i.test(t))).slice(0, 8).map(tile)}
            </div>
            {catalogueError && <p className="center" role="alert">{catalogueError}</p>}
            {!catalogueError && !products.some((p) => p.category === 'Bestsellers' || p.featured || (p.tags || []).some((t) => /bestseller/i.test(t))) && (
              <p className="center">Our bestsellers are coming soon.</p>
            )}
          </>
        )}
        <div className="center"><button className="primary-button" onClick={() => shopCategory('Bestsellers')}>Shop Bestsellers →</button></div>
      </section>

      {(Array.isArray(content.find((c) => c.key === 'custom-sections')?.value) ? content.find((c) => c.key === 'custom-sections')!.value : [])
        .filter((section: any) => section.enabled !== false)
        .sort((a: any, b: any) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
        .map((section: any) => <section className="section custom-section" key={section.id}>
          <div className="section-heading section-heading-centered">
            {section.eyebrow && <div className="eyebrow">{section.eyebrow}</div>}
            <h2>{section.title}</h2>
          </div>
          {section.image && <img src={section.image} alt="" />}
          {section.description && <p>{section.description}</p>}
        </section>)}

      <section className="section">
        <div className="section-heading section-heading-centered"><div className="eyebrow">WHAT OUR CUSTOMERS SAY</div><h2>Sweet <i>Testimonials</i></h2></div>
        <div className="testimonial-grid">
          {[
            { name: 'Priya S.', text: 'The chocolate chip cookies were divine — perfectly chewy and not too sweet. Will order again!', stars: 5 },
            { name: 'Rahul M.', text: 'Gift box packaging was beautiful and the brownies were incredibly fudgy. Highly recommend.', stars: 5 },
            { name: 'Ananya K.', text: 'Fresh, warm and delivered on time. Cruvita has become our go-to for celebrations.', stars: 4 },
          ].map((t) => <article className="testimonial-card" key={t.name}>
            <div className="stars">{'★'.repeat(t.stars)}{'☆'.repeat(5 - t.stars)}</div>
            <p>“{t.text}”</p>
            <strong>— {t.name}</strong>
          </article>)}
          {testimonials.map((review: { name: string; text: string }, index: number) => <article className="testimonial-card" key={`${review.name}-${index}`}>
            <p>“{review.text}”</p>
            <strong>— {review.name}</strong>
          </article>)}
        </div>
      </section>

      <section className="section">
        <div className="section-heading section-heading-centered"><div className="eyebrow">SHORTS & REELS</div><h2>Sweet <i>Moments</i></h2></div>
        <div className="reels-row">
          {shorts.length ? shorts.map((s: any, i: number) => {
            const url = typeof s === 'string' ? s : (s?.url || s?.video || s?.src);
            if (!url) return <div className="reel-placeholder" key={i}>▶</div>;
            const yt = String(url).match(/(?:youtube\.com\/shorts\/|youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
            if (yt) {
              return <iframe key={i} className="reel-video" src={`https://www.youtube.com/embed/${yt[1]}?playsinline=1&mute=1&loop=1&playlist=${yt[1]}`} title="Short video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />;
            }
            return (
              <video
                key={i}
                className="reel-video"
                src={url}
                muted
                loop
                playsInline
                autoPlay
                controls
                preload="metadata"
                onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none'; }}
              />
            );
          }) : [1, 2, 3, 4].map((i) => <div className="reel-placeholder" key={i}>▶</div>)}
        </div>
      </section>

      <section className="section tinted brand-story">
        <div className="brand-story-copy">
          <div className="eyebrow">OUR STORY</div>
          <h2>Every bite tells a <i>sweet story.</i></h2>
          <p>{settings.about || 'Cruvita Cookies makes thoughtful cookies, brownies and gift boxes for life’s sweetest moments.'}</p>
          <button className="primary-button" onClick={() => navigate('about')}>Read our story →</button>
        </div>
      </section>
    </>}

    {page === 'shop' && <main className="page-shell">
      <div className="eyebrow">DISCOVER THE GOODNESS</div>
      <h1>Our Sweet <i>Collection</i></h1>
      <div className="shop-layout">
      <button className="mobile-filter-toggle outline-button" type="button" aria-expanded={filtersOpen} aria-controls="shop-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
        <SlidersHorizontal size={17} /> {filtersOpen ? 'Hide filters' : 'Search & filters'}
      </button>
      <aside id="shop-filters" className={`filter-panel${filtersOpen ? ' filter-panel--open' : ''}`} aria-label="Product filters">
        <h2>Filters</h2>
        <label className="search"><Search size={17} /><input aria-label="Search treats" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search treats…" /></label>
        <div className="filter-categories"><strong>Category</strong><div className="chips">{['All', ...categoriesForNav].map((c) => <button key={c} className={category === c ? 'active' : ''} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div></div>
        <label>Min price (₹)<input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" /></label>
        <label>Max price (₹)<input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" /></label>
        <button className="outline-button" type="button" onClick={() => { setMinPrice(''); setMaxPrice(''); setCategory('All'); setSearch(''); }}>Clear filters</button>
      </aside>
      <div className="shop-results">
      <div className="filter-bar">
        <span><SlidersHorizontal size={15} /> {loading ? 'Loading products…' : catalogueError ? 'Product count unavailable' : `${visible.length} products`}</span>
        <label>Sort <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">Newest</option><option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option><option value="name">Name</option>
        </select></label>
      </div>
      <div className="product-grid">{visible.map(tile)}</div>
      {!loading && catalogueError && <div className="notice notice-error" role="alert">{catalogueError}</div>}
      {!loading && !catalogueError && !visible.length && <div className="empty">No products found. Try another search.</div>}
      </div>
      </div>

    </main>}

    {page === 'product' && selected && <main className="page-shell">
      <button className="back" onClick={() => navigate('shop')}>← Back to shop</button>
      <div className="detail">
        <div>
          <div className="detail-photo">
            {selected.images?.[gallery] ? <img src={selected.images[gallery]} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '🍪'}
          </div>
          {selected.images?.length > 1 && <div className="gallery-thumbs">
            {selected.images.map((img, i) => <button key={img + i} className={gallery === i ? 'active' : ''} onClick={() => setGallery(i)}>
              <img src={img} alt={'View ' + (i + 1)} />
            </button>)}
          </div>}
        </div>
        <div className="detail-copy">
          <div className="eyebrow">{selected.category.toUpperCase()}</div>
          <h1>{selected.name}</h1>
          <div className="price big">₹{selected.price} {selected.compareAt && <del>₹{selected.compareAt}</del>}</div>
          <p>{selected.description}</p>
          {(selected.variants?.length ?? 0) > 0 && <div className="muted tiny">Variants: {selected.variants?.map((v: any) => v.name).join(', ')}</div>}
          <div className="detail-actions">
            <button className="primary-button" onClick={() => add(selected._id)}>Add to Bag →</button>
            <button className="outline-button" onClick={() => buyNow(selected._id)}>Buy Now →</button>
          </div>
        </div>
      </div>
      {products.some((p) => p._id !== selected._id && p.category === selected.category) && <section className="related-products">
        <div className="section-heading"><div className="eyebrow">A LITTLE MORE TO LOVE</div><h2>You may also <i>like</i></h2></div>
        <div className="product-grid">
          {products.filter((p) => p._id !== selected._id && p.category === selected.category).slice(0, 4).map(tile)}
        </div>
      </section>}
    </main>}


    {page === 'cart' && <main className="page-shell">
      <div className="eyebrow">YOUR SWEET SELECTION</div><h1>Shopping <i>Bag</i></h1>
      {entries.length ? <div className="checkout-grid">
        <div className="cart-items">
          {entries.map(({ p, qty }) => <div className="cart-item" key={p._id}>
            <div className="cart-emoji">{p.images?.[0] ? <img src={p.images[0]} alt={p.name} style={{ width: 56, height: 56, objectFit: 'contain' }} /> : '🍪'}</div>
            <div className="cart-description">
              <h3>{p.name}</h3><p>₹{p.price} each</p>
              <div className="quantity"><button onClick={() => changeQty(p._id, -1)}><Minus size={14} /></button><span>{qty}</span><button onClick={() => changeQty(p._id, 1)}><Plus size={14} /></button></div>
            </div>
            <strong>₹{p.price * qty}</strong>
            <button className="iconbtn" aria-label="Remove" onClick={() => setCart((c) => c.filter((x) => x.id !== p._id))}><Trash2 size={17} /></button>
          </div>)}
        </div>
        <aside className="summary">
          <h3>Order Summary</h3>
          <div><span>Subtotal</span><strong>₹{subtotal}</strong></div>
          <div><span>Delivery charges</span><strong>Enter PIN code</strong></div>
          <div className="summary-total"><span>Subtotal</span><strong>₹{subtotal}</strong></div>
          <button className="primary-button full" onClick={continueFromCart}>Continue to Checkout →</button>
        </aside>
      </div> : <div className="empty"><ShoppingBag size={44} /><h2>Your bag is waiting for something sweet.</h2><button className="primary-button" onClick={() => navigate('shop')}>Shop Treats →</button></div>}
    </main>}

    {page === 'checkout' && <main className="page-shell">
      <div className="eyebrow">NO ACCOUNT REQUIRED</div><h1>Guest <i>Checkout</i></h1>
      <ol className="checkout-steps" aria-label="Checkout progress">
        {['Bag', 'Bill summary', 'Delivery details', 'Payment', 'Confirmation'].map((step, i) =>
          <li key={step} className={i === 2 ? 'active' : i < 2 ? 'done' : ''}><span>{i + 1}</span>{step}</li>)}
      </ol>
      {buyNowItems && <p className="muted tiny">Buying this item directly — other products in your bag are not included.</p>}
      {!checkoutEntries.length && <div className="empty"><ShoppingBag size={40} /><h2>Your bag is empty.</h2><button className="primary-button" onClick={() => navigate('shop')}>Shop Treats →</button></div>}
      {!!checkoutEntries.length && <div className="checkout-grid checkout-layout">
        <form id="checkout-form" className="checkout-form" onSubmit={checkout}>
          <h2>Delivery Details</h2>
          {([
            ['name', 'Full name', 'text'], ['phone', 'Phone number', 'tel'], ['email', 'Email address', 'email'],
            ['houseNo', 'House/flat number', 'text'], ['street', 'Street and area', 'text'],
            ['landmark', 'Landmark (optional)', 'text'], ['city', 'City', 'text'],
          ] as const).map(([k, label, type]) => (
            <label key={k}>{label}
              <input required={k !== 'landmark'} type={type} autoComplete={{ name: 'name', phone: 'tel', email: 'email', city: 'address-level2', houseNo: 'address-line1', street: 'address-line2', landmark: 'off' }[k]}
                value={customer[k]} onChange={(e) => setCustomer((c) => ({ ...c, [k]: e.target.value }))} />
            </label>
          ))}
          <label>State or union territory
            <select required autoComplete="address-level1" value={customer.state} onChange={(e) => setCustomer((c) => ({ ...c, state: e.target.value }))}>
              <option value="">Select state or union territory</option>
              {['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'].map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
          <label>PIN code
            <div className="pin-check-row">
              <input required inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="e.g. 518502"
                value={customer.pin} onChange={(e) => setCustomer((c) => ({ ...c, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
            </div>
          </label>
          {quoteBusy && <p className="muted tiny" role="status">Calculating delivery charges…</p>}
          {quoteError && <p className="muted tiny pin-error" role="alert">{quoteError}</p>}
        </form>
        <aside className="summary">
          <h3>Order Summary</h3>
          <div className="bill-items">
            {checkoutEntries.map(({ p, qty }) => <div key={p._id}><span>{p.name} × {qty}</span><strong>₹{p.price * qty}</strong></div>)}
          </div>
          <div><span>Product subtotal</span><strong>₹{billSubtotal}</strong></div>
          {billDiscount > 0 && <div className="bill-discount"><span>Discount{coupon ? ` (${coupon})` : ''}</span><strong>− ₹{billDiscount}</strong></div>}
          <div><span>Taxes</span><strong>Included in MRP</strong></div>
          <div><span>Delivery charges</span><strong>{quoteBusy ? 'Calculating…' : billShipping === null ? 'Enter delivery address' : billShipping === 0 ? 'Free' : '₹' + billShipping}</strong></div>
          <div className="summary-total"><span>{bill ? 'Total payable' : 'Total before delivery'}</span><strong>₹{billTotal}</strong></div>
          <div className="coupon-box">
            <label htmlFor="coupon-code">Have a coupon? <span className="muted tiny">(optional)</span></label>
            <div className="coupon-row">
              <input id="coupon-code" value={couponInput} placeholder="Enter coupon code"
                onChange={(e) => { setCouponInput(e.target.value.toUpperCase().slice(0, 50)); setCouponError(''); }} />
            </div>
            {coupon && <div className="coupon-applied"><span>✓ {coupon} applied</span></div>}
            {couponError && <p className="muted tiny pin-error" role="alert">{couponError}</p>}
          </div>
          <button className="primary-button full checkout-pay" form="checkout-form" type="submit" disabled={!canPay}>
            {busy ? 'Preparing payment…' : quoteBusy ? 'Calculating delivery…' : 'Pay Securely →'}
          </button>
          {!paymentAvailable && <p className="muted tiny">Payment is currently unavailable. Please try again later.</p>}
        </aside>
      </div>}
    </main>}

    {page === 'simulation' && sim && <main className="page-shell prose">
      <div className="sim-card">
        <AlertTriangle size={30} />
        <h2>Development-only payment simulation</h2>
        <p>Razorpay credentials are not configured. No real payment will be collected and no real order will be sent to a payment gateway. This option is unavailable in production.</p>
        <p><strong>Amount:</strong> ₹{(sim.amount / 100).toFixed(2)} &nbsp; <strong>Order:</strong> {sim.razorpayOrderId}</p>
        <button className="primary-button" disabled={busy} onClick={confirmSimulation}>{busy ? 'Confirming…' : 'Confirm simulated payment'}</button>
        <button className="outline-button" onClick={() => navigate('checkout')}>Go back</button>
      </div>
    </main>}

    {page === 'success' && <main className="page-shell prose">
      <div className="success-card"><Check size={36} />
        <h1>Thank you for <i>your order!</i></h1>
        <p>Order number: <strong>{order?.number}</strong></p>
        <p>Questions? Contact <a href={'mailto:' + email}>{email}</a> or <a href={'tel:' + String(phone).replace(/[^\d+]/g, '')}>{phone}</a>.</p>
        {order?.simulation && <p className="sim-label">This was a development simulation. No payment was collected.</p>}
        <p>Save your private tracking token to check your order later.</p>
        <div className="token-box"><code>{order?.token}</code><button className="iconbtn" aria-label="Copy token" onClick={() => { navigator.clipboard?.writeText(order?.token || ''); setCopied(true); }}>{copied ? <Check /> : <Copy />}</button></div>
        <p className="muted">Save your order number and token above to track your order later.</p>
      </div>
      {trackingView(orderTracking)}
    </main>}



    {page === 'track' && <main className="page-shell prose">
      <div className="eyebrow">STAY IN THE LOOP</div>
      <h1>Track your <i>order</i></h1>
      <p className="muted">Enter the order number and the private token from your confirmation page.</p>
      <form className="checkout-form track-form" onSubmit={findOrder}>
        <label>Order number<input required value={track.number} onChange={(e) => setTrack((t) => ({ ...t, number: e.target.value }))} placeholder="CC-…" /></label>
        <label>Private tracking token<input required value={track.token} onChange={(e) => setTrack((t) => ({ ...t, token: e.target.value }))} /></label>
        <button className="primary-button" type="submit">Track order →</button>
      </form>
      {tracking && trackingView(tracking)}
    </main>}

    {page === 'about' && <StoryPage content={content.find((c) => c.key === 'our-story')?.value || {}} products={products} loading={loading} tile={tile} />}

    {page === 'contact' && <ContactPage email={email} phone={phone} address={address} whatsapp={whatsappNumber} fssaiLicense={fssaiLicense} />}

    {page === 'policies' && <main className="page-shell prose">
      <h1>Store <i>Policies</i></h1>
      <div className="chips policy-tabs">
        {POLICIES.map((p) => <button key={p.key} className={policy === p.key ? 'active' : ''}
          onClick={() => { setPolicy(p.key); window.history.pushState({}, '', '/policies/' + p.key); }}>{p.label}</button>)}
      </div>
      <div className="policy-body">
        <h2>{POLICIES.find((p) => p.key === policy)?.label}</h2>
        <p>{settings[POLICIES.find((p) => p.key === policy)?.field || 'shippingPolicy'] || 'This policy has not been published yet. Please contact us for details.'}</p>
      </div>
      <p className="muted tiny">Last updated: {new Date().getFullYear()}</p>
    </main>}

    <footer className="footer">
      <div className="footer-grid">
        <div>
          <img src={settings.logo || '/cruvita-logo-transparent.png'} alt="Cruvita Cookies" className="footer-logo" />
          <p>{settings.about || 'Small-batch cookies and brownies, baked to order. Made with love, baked for you.'}</p>
        </div>
        <div>
          <h4>Shop</h4>
          <button onClick={() => shopCategory('All')}>Shop All</button>
          {categoriesForNav.map((c) => <button key={c} onClick={() => shopCategory(c)}>{c}</button>)}
        </div>
        <div>
          <h4>Help</h4>
          <button onClick={() => navigate('policies', { policy: 'shipping' })}>Shipping &amp; Delivery</button>
          <button onClick={() => navigate('policies', { policy: 'privacy' })}>Privacy Policy</button>
          <button onClick={() => navigate('policies', { policy: 'terms' })}>Terms of Service</button>
          <button onClick={() => navigate('track')}>Track your order</button>
          <button onClick={() => navigate('contact')}>Contact</button>
        </div>
        <div>
          <h4>Contact</h4>
          <p>{address}</p>
          <p><a href={'tel:' + String(phone).replace(/[^\d+]/g, '')}>{phone}</a></p>
          <a href={'mailto:' + email}>{email}</a>
          <p>FSSAI Lic. No. {fssaiLicense}</p>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} Cruvita Cookies. All rights reserved.</div>
    </footer>
    <a className="whatsapp-float whatsapp-button whatsapp-fab" id="whatsapp-float" href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.52-8.413Z"/></svg>
    </a>
  </>;
}
