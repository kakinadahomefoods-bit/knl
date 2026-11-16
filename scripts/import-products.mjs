import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI first');

const products = [
  {
    name: 'All Mix Cookies – 250g (4 Types of Cookies)',
    slug: 'all-mix-cookies-250g-4-types-of-cookies',
    category: 'Cookies',
    description: 'Indulge in the ultimate cookie experience with our All Mix Cookies. Perfectly crafted for cookie enthusiasts, this delightful 250g assortment brings together four irresistible types of cookies in one convenient package. Whether you are craving something buttery, chocolaty, or nutty, this mix has something to satisfy every taste bud. Eggless.',
    price: 199, compareAt: 299, stock: 99, weightGrams: 250, featured: true, tags: ['Eggless', 'Bestseller'],
  },
  {
    name: 'Chocolate Chip Cookies 400g – Pack of 6',
    slug: 'chocolate-chip-cookies-400g-6pcs',
    category: 'Cookies',
    description: 'Discover the perfect balance of sweetness, crunch, and gooey decadence with Chocolate Chip Cookies. Handcrafted with love and baked to golden perfection, loaded with rich, velvety chocolate chips that melt in your mouth. Each pack includes 6 large cookies, 400g total.',
    price: 199, compareAt: 399, stock: 99, weightGrams: 400, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Chocolate Chip Cookies 700g – Pack of 8',
    slug: 'chocolate-chip-cookies-700g-pack-of-8',
    category: 'Cookies',
    description: 'Experience the ultimate cookie delight with Chocolate Chip Cookies. Crafted with love and baked to golden perfection, packed with premium, gooey chocolate chips. A generous 700g pack with 8 cookies, perfect for sharing or gifting.',
    price: 349, compareAt: 699, stock: 99, weightGrams: 700, featured: false, tags: [],
  },
  {
    name: 'Double Chocolate Chip Cookies 700g – Pack of 8',
    slug: 'double-chocolate-chip-cookies-700g-pack-of-8',
    category: 'Cookies',
    description: 'Treat yourself to the ultimate chocolate lover’s dream with Double Chocolate Chip Cookies. Each bite is a decadent explosion of rich, velvety chocolate, baked to achieve the perfect balance of gooey goodness and crisp edges. 700g pack of 8 cookies. Eggless.',
    price: 349, compareAt: 799, stock: 99, weightGrams: 700, featured: true, tags: ['Eggless', 'Bestseller'],
  },
  {
    name: 'Double Chocolate Chip Cookies 400g – Pack of 6',
    slug: 'double-chocolate-chip-cookies-400g-pack-of-6',
    category: 'Cookies',
    description: 'A chocolate lover’s dream: rich, velvety chocolate dough generously loaded with mouthwatering chocolate chips for the perfect balance of chewy and gooey. 400g pack of 6 cookies. Eggless.',
    price: 249, compareAt: 399, stock: 99, weightGrams: 400, featured: true, tags: ['Eggless', 'Bestseller'],
  },
  {
    name: 'Chocolate Walnut Brownie – Pack of 6',
    slug: 'chocolate-walnut-brownie-pack-of-6',
    category: 'Brownies',
    description: 'Rich, indulgent brownies combining velvety chocolate and crunchy walnuts. Baked to perfection with premium ingredients for a moist, fudgy texture and deep chocolatey taste. Pack of 6.',
    price: 399, compareAt: 799, stock: 99, weightGrams: 400, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Classic Chocolate Brownie – Pack of 6',
    slug: 'classic-chocolate-brownie-pack-of-6',
    category: 'Brownies',
    description: 'Rich, fudgy brownies with the perfect balance of gooey chocolate goodness and a satisfyingly crisp top layer. Baked to perfection for the ultimate texture and flavor. Pack of 6.',
    price: 389, compareAt: 799, stock: 0, weightGrams: 400, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Double Chocolate Brownies – Pack of 6',
    slug: 'double-chocolate-brownies-pack-of-6',
    category: 'Brownies',
    description: 'Fudgy brownies with a crisp top layer and moist, gooey center generously loaded with velvety chocolate chunks. Made with premium cocoa and real chocolate. Pack of 6.',
    price: 399, compareAt: 799, stock: 0, weightGrams: 400, featured: false, tags: [],
  },
  {
    name: 'All Mix Brownies',
    slug: 'all-mix-brownies',
    category: 'Brownies',
    description: 'An assorted mix of brownies for every chocolate craving. Small-batch, baked to order with real butter and chocolate.',
    price: 399, compareAt: 899, stock: 99, weightGrams: 400, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Dry Fruits Cookies 250g - Pack of 5',
    slug: 'dry-fruits-cookies-250g-pack-of-5',
    category: 'Cookies',
    description: 'A delightful treat combining the richness of premium dry fruits with the buttery goodness of perfectly baked cookies. Crafted with care and packed with wholesome ingredients. 250g, pack of 5.',
    price: 349, compareAt: 649, stock: 99, weightGrams: 250, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Oreo Cookies 400g – Pack of 6',
    slug: 'oreo-cookies-400g-pack-of-6',
    category: 'Cookies',
    description: 'Irresistible crunch and creamy filling of Oreo Cookies. Each 400g pack neatly sealed to preserve freshness. Great for sharing, parties, or movie nights. Pack of 6.',
    price: 249, compareAt: 399, stock: 99, weightGrams: 400, featured: false, tags: [],
  },
  {
    name: 'Oreo Cookies 700g – Pack of 8',
    slug: 'oreo-cookies-700g-pack-of-8',
    category: 'Cookies',
    description: 'Classic taste of Oreo signature chocolate cookies and smooth vanilla creme filling. 700g pack with 8 generous packs, perfect for sharing or keeping stocked. Pack of 8.',
    price: 349, compareAt: 799, stock: 99, weightGrams: 700, featured: false, tags: [],
  },
  {
    name: 'Nutella Brownies – Pack of 6',
    slug: 'nutella-brownies-pack-of-6',
    category: 'Brownies',
    description: 'Fudgy, decadent brownies infused with the rich, creamy goodness of Nutella. Each bite delivers a heavenly combination of gooey chocolate and smooth hazelnut spread. Pack of 6.',
    price: 399, compareAt: 799, stock: 99, weightGrams: 400, featured: false, tags: [],
  },
  {
    name: 'Red Velvet Cookies 400g – Pack of 6',
    slug: 'red-velvet-cookies-400g-pack-of-6',
    category: 'Cookies',
    description: 'A fusion of rich flavors and melt-in-your-mouth textures. Classic red velvet flavor with a subtle hint of cocoa and a creamy, velvety finish. 400g, pack of 6.',
    price: 219, compareAt: 399, stock: 99, weightGrams: 400, featured: false, tags: [],
  },
  {
    name: 'Red Velvet Cookies 700g – Pack of 8',
    slug: 'red-velvet-cookies-700g-pack-of-8',
    category: 'Cookies',
    description: 'Luxurious twist on the classic cookie, combining rich, velvety flavor with a perfectly soft and chewy texture. Made with premium ingredients. 700g, pack of 8. Eggless.',
    price: 399, compareAt: 799, stock: 99, weightGrams: 700, featured: false, tags: ['Eggless'],
  },
  {
    name: 'Mini Double Chocolate Chip Cookies (250g)',
    slug: 'mini-double-chocolate-chip-cookies-250g',
    category: 'Cookies',
    description: 'Mini double chocolate chip cookies, rich dark chocolate with chocolate chips, bite-sized and perfect for snacking. 250g pack.',
    price: 239, compareAt: 399, stock: 99, weightGrams: 250, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Mini Red Velvet Cookies (250g)',
    slug: 'mini-red-velvet-cookies-250g',
    category: 'Cookies',
    description: 'Mini red velvet cookies, soft and chewy with classic red velvet flavor. 250g pack.',
    price: 199, compareAt: 399, stock: 0, weightGrams: 250, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Mini Chocolate Chip Cookies',
    slug: 'mini-chocolate-chip-cookies',
    category: 'Cookies',
    description: 'Mini chocolate chip cookies, bite-sized golden treats with gooey chocolate chips. Perfect for snacking and sharing.',
    price: 199, compareAt: 349, stock: 99, weightGrams: 250, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Choco Chip Butter Cake 300g',
    slug: 'choco-chip-butter-cake-300g',
    category: 'Brownies',
    description: 'Choco chip butter cake, soft and buttery with chocolate chips. 300g.',
    price: 299, compareAt: 449, stock: 99, weightGrams: 300, featured: true, tags: ['Bestseller'],
  },
  {
    name: 'Almond Choco Cookies',
    slug: 'almond-choco-cookies',
    category: 'Cookies',
    description: 'Almond choco cookies made with almond flour, oats flour, jaggery powder, butter and other carefully selected ingredients. No maida, no refined sugar, sweetened with jaggery. Pack of 6 pieces.',
    price: 299, compareAt: 599, stock: 99, weightGrams: 250, featured: true, tags: ['Bestseller'],
  },
];

await mongoose.connect(uri);
const col = mongoose.connection.collection('products');
let n = 0;
for (const p of products) {
  await col.updateOne(
    { slug: p.slug },
    {
      $set: {
        name: p.name,
        slug: p.slug,
        category: p.category,
        description: p.description,
        price: p.price,
        compareAt: p.compareAt,
        stock: p.stock,
        lowStockAt: 5,
        images: [],
        publicIds: [],
        variants: [],
        tags: p.tags,
        featured: p.featured,
        published: true,
        weightGrams: p.weightGrams,
      },
    },
    { upsert: true }
  );
  n++;
}
console.log('Imported/upserted', n, 'products');
await mongoose.disconnect();
