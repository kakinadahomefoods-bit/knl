# Reference comparison report — Cruvita Cookies vs crusantcookies.com

## Reference inspected
- URL: https://www.crusantcookies.com/
- Brand in reference: "crusant cookies" (replaced with Cruvita Cookies)
- Contact: crusantcookies.in@gmail.com, +91 81256 24430, 8-3-112, Karimnagar, Telangana, India
- FSSAI Lic. 23625014000747
- Currency: INR (₹)
- Theme color: #3F201F, notice bar #2A0C0A, menu bar #FFC0CB
- Font: Noto Sans

## Catalogue found (20 products)
Cookies (14): All Mix Cookies 250g, Chocolate Chip 400g/700g, Double Chocolate Chip 400g/700g, Dry Fruits 250g, Mini Chocolate Chip, Mini Double Chocolate Chip 250g, Mini Red Velvet 250g, Oreo 400g/700g, Red Velvet 400g/700g, Almond Choco Cookies.
Brownies (6): All Mix Brownies, Chocolate Walnut, Classic Chocolate, Double Chocolate, Nutella Brownies, Choco Chip Butter Cake 300g.

## Categories
Cookies, Brownies, Gift Boxes (no standalone products found), Bestsellers (13 products).

## Prices recorded
Reference sale prices and MRP imported; see scripts/import-products.mjs. Some products marked Out of Stock (Classic Chocolate Brownie, Double Chocolate Brownies, Mini Red Velvet Cookies).

## Design notes
- Header: announcement bar, logo, nav (Cookies, Brownies, About Us), search, wishlist, cart.
- Homepage: hero, category grid, bestsellers/full range, footer.
- Product page: gallery, price, compareAt, description, add to cart, buy now (UI), PIN check (UI), related products.
- Cart/checkout: guest checkout, coupon, shipping threshold 999/free above, flat fee 80 (configurable via settings).

## Differences / limitations
- Reference photography and logo were NOT copied (permission not confirmed). Product images left for admin upload via Cloudinary.
- Gift Boxes collection had no separate products in reference; category retained for admin use.
- Some reference policies/pages (shipping, returns, privacy, terms) are templated; Cruvita uses admin-editable settings.
- Image generation unavailable due to credits; admin upload flow is functional.
- Razorpay/Delhivery remain placeholder until credentials supplied.

## Verification
- Production build: passing.
- MongoDB import: 20 products + 4 categories upserted.
- Admin login tested successfully.
