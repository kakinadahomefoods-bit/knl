import mongoose, { Schema } from 'mongoose';

const opt = { timestamps: true };

const variant = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120 },
    sku: { type: String, trim: true, maxlength: 120 },
    price: { type: Number, min: 0 },
    stock: { type: Number, min: 0, default: 0 },
  },
  { _id: true }
);

const product = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, maxlength: 220 },
    sku: { type: String, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 8000 },
    price: { type: Number, required: true, min: 0 },
    compareAt: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    lowStockAt: { type: Number, default: 5, min: 0 },
    images: { type: [String], default: [] },
    publicIds: { type: [String], default: [] },
    variants: { type: [variant], default: [] },
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: false },
    weightGrams: { type: Number, default: 250, min: 0 },
    seoTitle: { type: String, trim: true, maxlength: 200 },
    seoDescription: { type: String, trim: true, maxlength: 400 },
  },
  opt
);
product.index({ published: 1, category: 1, createdAt: -1 });
product.index({ published: 1, featured: 1 });

const category = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000 },
    image: { type: String, trim: true },
    publicId: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  opt
);
category.index({ published: 1, sortOrder: 1 });

const shipmentUpdate = new Schema(
  {
    status: { type: String, trim: true },
    location: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    raw: Schema.Types.Mixed,
  },
  { _id: true }
);

const notification = new Schema(
  {
    type: { type: String, required: true },
    sent: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
    detail: String,
  },
  { _id: true }
);

const order = new Schema(
  {
    number: { type: String, unique: true, required: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    customer: {
      name: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pin: String,
    },
    items: [
      {
        productId: { type: String, index: true },
        name: String,
        price: Number,
        qty: Number,
        image: String,
      },
    ],
    subtotal: Number,
    shipping: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    coupon: String,
    total: Number,
    paymentStatus: { type: String, default: 'pending', index: true },
    fulfillmentStatus: { type: String, default: 'unfulfilled', index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: String,
    simulation: { type: Boolean, default: false },
    trackingToken: { type: String, unique: true, sparse: true },
    shipment: {
      awb: String,
      status: String,
      reference: String,
      labelUrl: String,
      simulated: { type: Boolean, default: false },
      updates: { type: [shipmentUpdate], default: [] },
      providerPayload: Schema.Types.Mixed,
    },
    notifications: { type: [notification], default: [] },
    inventoryCommitted: { type: Boolean, default: false },
    inventoryMode: { type: String, enum: ['tracked', 'unlimited'], default: 'tracked' },
    inventoryError: String,
    couponCommitted: { type: Boolean, default: false },
    refundAmount: { type: Number, default: 0 },
    refundedAt: Date,
    restocked: { type: Boolean, default: false },
    notes: String,
  },
  opt
);
order.index({ createdAt: -1 });

const coupon = new Schema(
  {
    code: { type: String, unique: true, trim: true },
    type: { type: String, enum: ['percent', 'fixed'] },
    value: Number,
    minOrder: Number,
    maxDiscount: Number,
    enabled: Boolean,
    expiresAt: Date,
    usageLimit: Number,
    used: { type: Number, default: 0 },
  },
  opt
);

const content = new Schema({ key: { type: String, unique: true }, value: Schema.Types.Mixed }, opt);
const admin = new Schema(
  { email: { type: String, unique: true }, passwordHash: String, role: { type: String, default: 'owner' } },
  opt
);

const payment = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    number: { type: String, index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true, sparse: true, unique: true },
    amount: Number,
    currency: { type: String, default: 'INR' },
    status: { type: String, default: 'created' },
    method: String,
    simulation: { type: Boolean, default: false },
    signatureVerified: { type: Boolean, default: false },
    refunds: [
      { amount: Number, refundId: String, status: String, at: { type: Date, default: Date.now } },
    ],
  },
  opt
);

const media = new Schema(
  {
    publicId: { type: String, unique: true, required: true },
    url: { type: String, required: true },
    folder: { type: String, required: true, index: true },
    format: String,
    bytes: Number,
    width: Number,
    height: Number,
    uploadedBy: String,
  },
  opt
);

export const Product = mongoose.models.Product || mongoose.model('Product', product);
export const Category = mongoose.models.Category || mongoose.model('Category', category);
export const Order = mongoose.models.Order || mongoose.model('Order', order);
export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', coupon);
export const Content = mongoose.models.Content || mongoose.model('Content', content);
export const Admin = mongoose.models.Admin || mongoose.model('Admin', admin);
export const Payment = mongoose.models.Payment || mongoose.model('Payment', payment);
export const Media = mongoose.models.Media || mongoose.model('Media', media);
