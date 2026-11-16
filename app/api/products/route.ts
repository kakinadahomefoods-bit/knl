import { db } from '@/lib/db';
import { Product, Category } from '@/lib/models';
import { isAdmin, adminDenied, clean } from '@/lib/security';
import { optimizedImageUrl } from '@/lib/cloudinary';
import { slugify } from '@/lib/validation';
import { mongoErrorSummary } from '@/lib/mongo-diagnostics';

export const runtime = 'nodejs';

function nonNegative(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function present(doc: any) {
  return {
    ...doc,
    _id: String(doc._id),
    images: (doc.images || []).map((u: string) => optimizedImageUrl(u)),
  };
}

export async function GET(req: Request) {
  try {
    await db();
    const u = new URL(req.url);
    const admin = u.searchParams.get('admin') === '1';
    if (admin && !(await isAdmin())) return adminDenied();

    const filter: Record<string, unknown> = admin ? {} : { published: true };
    const category = clean(u.searchParams.get('category'), 120);
    const q = clean(u.searchParams.get('q'), 120);
    const slug = clean(u.searchParams.get('slug'), 220);
    const featured = u.searchParams.get('featured') === '1';
    if (category && category !== 'All') filter.category = category;
    if (slug) filter.slug = slug;
    if (featured) filter.featured = true;
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
    ];

    const sortParam = u.searchParams.get('sort') || 'new';
    const sort: Record<string, 1 | -1> =
      sortParam === 'price-asc' ? { price: 1 }
      : sortParam === 'price-desc' ? { price: -1 }
      : sortParam === 'name' ? { name: 1 }
      : { createdAt: -1 };

    const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit')) || 60));
    const [docs, total, categories] = await Promise.all([
      Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Product.countDocuments(filter),
      Category.find(admin ? {} : { published: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    return Response.json({
      products: docs.map(present),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      categories: categories.map((c: any) => ({
        ...c,
        _id: String(c._id),
        image: optimizedImageUrl(c.image),
      })),
    });
  } catch (error) {
    // Never log connection strings or raw driver messages, which may contain credentials.
    const kind = !process.env.MONGODB_URI ? 'MONGODB_URI_MISSING'
      : error instanceof Error && ['MongoServerSelectionError', 'MongooseServerSelectionError'].includes(error.name) ? 'MONGODB_SERVER_SELECTION_FAILED'
      : error instanceof Error && error.name === 'MongoServerError' ? 'MONGODB_SERVER_ERROR'
      : 'PRODUCT_QUERY_FAILED';
    console.error('[products] Catalogue request failed:', kind, mongoErrorSummary(error));
    return Response.json({ error: 'Database unavailable' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return adminDenied();
  try {
    const x = await req.json();
    await db();
    const name = clean(x.name, 200);
    if (!name) return Response.json({ error: 'Name required' }, { status: 400 });
    const price = Number(x.price);
    if (!Number.isFinite(price) || price < 0) return Response.json({ error: 'Invalid price' }, { status: 400 });
    const p = await Product.create({
      name,
      slug: clean(x.slug, 220) || slugify(name),
      category: clean(x.category, 120) || 'Cookies',
      description: clean(x.description, 8000),
      price,
      compareAt: x.compareAt ? Number(x.compareAt) : undefined,
      stock: nonNegative(x.stock),
      lowStockAt: nonNegative(x.lowStockAt, 5),
      images: Array.isArray(x.images) ? x.images.filter((i: unknown) => typeof i === 'string') : [],
      publicIds: Array.isArray(x.publicIds) ? x.publicIds.filter((i: unknown) => typeof i === 'string') : [],
      variants: Array.isArray(x.variants) ? x.variants : [],
      tags: Array.isArray(x.tags) ? x.tags : [],
      featured: !!x.featured,
      published: !!x.published,
      weightGrams: Number(x.weightGrams) || 250,
      seoTitle: clean(x.seoTitle, 200),
      seoDescription: clean(x.seoDescription, 400),
    });
    return Response.json({ product: present(p.toObject()) }, { status: 201 });
  } catch (e: any) {
    return Response.json(
      { error: e?.code === 11000 ? 'Duplicate slug' : 'Invalid product' },
      { status: 400 }
    );
  }
}
