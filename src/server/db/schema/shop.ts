/**
 * Shop tables (WooCommerce/Shopify model): every product has at least one
 * variant, money is stored in minor units (Rappen) as integers, tax rates in
 * basis points (8.1 % = 810).
 */
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { media } from "./core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const created = () => ts("created_at").notNull().defaultNow();
const updated = () => ts("updated_at").notNull().defaultNow();

export type Address = {
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  street2?: string;
  zip: string;
  city: string;
  country: string; // ISO 3166-1 alpha-2
  phone?: string;
};

export const taxClasses = pgTable("tax_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  rateBp: integer("rate_bp").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: created(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    imageId: uuid("image_id").references(() => media.id, { onDelete: "set null" }),
    sort: integer("sort").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["draft", "active", "archived"] }).notNull().default("draft"),
    type: text("type", { enum: ["physical", "digital", "service"] }).notNull().default("physical"),
    shortDescription: text("short_description").notNull().default(""),
    /** sanitised HTML from the editor */
    description: text("description").notNull().default(""),
    vendor: text("vendor").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** option names in display order, e.g. ["Grösse", "Farbe"]; empty = single variant */
    options: jsonb("options").$type<{ name: string; values: string[] }[]>().notNull().default([]),
    taxClassId: uuid("tax_class_id").references(() => taxClasses.id, { onDelete: "set null" }),
    featured: boolean("featured").notNull().default(false),
    /** cached from variants for listing/sorting */
    priceMin: integer("price_min").notNull().default(0),
    priceMax: integer("price_max").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: ts("published_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("products_slug_idx").on(t.slug), index("products_status_idx").on(t.status)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** e.g. "M / Blau"; empty for the single default variant */
    title: text("title").notNull().default(""),
    /** option values in the order of products.options */
    optionValues: jsonb("option_values").$type<string[]>().notNull().default([]),
    sku: text("sku"),
    barcode: text("barcode"),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    costPrice: integer("cost_price"),
    trackInventory: boolean("track_inventory").notNull().default(true),
    stock: integer("stock").notNull().default(0),
    allowBackorder: boolean("allow_backorder").notNull().default(false),
    weightGrams: integer("weight_grams"),
    imageId: uuid("image_id").references(() => media.id, { onDelete: "set null" }),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("variants_product_idx").on(t.productId), index("variants_sku_idx").on(t.sku)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    alt: text("alt").notNull().default(""),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    stockAfter: integer("stock_after").notNull(),
    reason: text("reason", { enum: ["order", "cancel", "refund", "manual", "import", "return"] }).notNull(),
    reference: text("reference").notNull().default(""),
    userId: uuid("user_id"),
    createdAt: created(),
  },
  (t) => [index("stock_movements_variant_idx").on(t.variantId, t.createdAt)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    /** null = guest customer without an account */
    passwordHash: text("password_hash"),
    acceptsMarketing: boolean("accepts_marketing").notNull().default(false),
    note: text("note").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    defaultAddress: jsonb("default_address").$type<Address | null>(),
    ordersCount: integer("orders_count").notNull().default(0),
    totalSpent: integer("total_spent").notNull().default(0),
    lastOrderAt: ts("last_order_at"),
    disabled: boolean("disabled").notNull().default(false),
    emailVerifiedAt: ts("email_verified_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("customers_email_idx").on(t.email)],
);

export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  label: text("label").notNull().default(""),
  address: jsonb("address").$type<Address>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: created(),
});

export const customerSessions = pgTable("customer_sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  createdAt: created(),
  expiresAt: ts("expires_at").notNull(),
});

export const carts = pgTable("carts", {
  /** sha256 of the cart token (cookie or API) */
  id: text("id").primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  couponCode: text("coupon_code"),
  email: text("email"),
  createdAt: created(),
  updatedAt: updated(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("cart_items_unique").on(t.cartId, t.variantId)],
);

export const shippingZones = pgTable("shipping_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** ISO codes; ["*"] = rest of the world */
  countries: jsonb("countries").$type<string[]>().notNull().default([]),
  sort: integer("sort").notNull().default(0),
  createdAt: created(),
});

export const shippingMethods = pgTable("shipping_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => shippingZones.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: text("type", { enum: ["flat", "free", "pickup", "weight"] }).notNull().default("flat"),
  price: integer("price").notNull().default(0),
  /** free above this subtotal (null = never) */
  freeAbove: integer("free_above"),
  /** for type "weight": [{ upToGrams, price }] ascending */
  weightRates: jsonb("weight_rates").$type<{ upToGrams: number; price: number }[]>().notNull().default([]),
  minSubtotal: integer("min_subtotal"),
  deliveryDaysMin: integer("delivery_days_min"),
  deliveryDaysMax: integer("delivery_days_max"),
  taxClassId: uuid("tax_class_id").references(() => taxClasses.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: created(),
});

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    type: text("type", { enum: ["percent", "fixed", "free_shipping"] }).notNull(),
    /** percent in basis points (10 % = 1000) or a fixed amount in Rappen */
    value: integer("value").notNull().default(0),
    minSubtotal: integer("min_subtotal"),
    usageLimit: integer("usage_limit"),
    usageLimitPerCustomer: integer("usage_limit_per_customer"),
    usedCount: integer("used_count").notNull().default(0),
    productIds: jsonb("product_ids").$type<string[]>().notNull().default([]),
    categoryIds: jsonb("category_ids").$type<string[]>().notNull().default([]),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("coupons_code_idx").on(t.code)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** sequential, human-friendly (shown with the configured prefix) */
    number: integer("number").notNull(),
    /** secret for the thank-you page and guest order lookup */
    accessToken: text("access_token").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    status: text("status", { enum: ["pending", "processing", "on_hold", "completed", "cancelled", "refunded", "failed"] })
      .notNull()
      .default("pending"),
    paymentStatus: text("payment_status", { enum: ["unpaid", "pending", "authorized", "paid", "partially_refunded", "refunded", "failed"] })
      .notNull()
      .default("unpaid"),
    fulfillmentStatus: text("fulfillment_status", { enum: ["unfulfilled", "partial", "fulfilled", "returned"] })
      .notNull()
      .default("unfulfilled"),
    currency: text("currency").notNull().default("CHF"),
    pricesIncludeTax: boolean("prices_include_tax").notNull().default(true),
    subtotal: integer("subtotal").notNull(),
    discountTotal: integer("discount_total").notNull().default(0),
    shippingTotal: integer("shipping_total").notNull().default(0),
    taxTotal: integer("tax_total").notNull().default(0),
    total: integer("total").notNull(),
    refundedTotal: integer("refunded_total").notNull().default(0),
    couponCode: text("coupon_code"),
    shippingMethodId: uuid("shipping_method_id"),
    shippingMethodName: text("shipping_method_name").notNull().default(""),
    billingAddress: jsonb("billing_address").$type<Address>().notNull(),
    shippingAddress: jsonb("shipping_address").$type<Address | null>(),
    customerNote: text("customer_note").notNull().default(""),
    paymentMethod: text("payment_method").notNull().default(""),
    paymentReference: text("payment_reference"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    source: text("source").notNull().default("storefront"),
    ip: text("ip").notNull().default(""),
    paidAt: ts("paid_at"),
    fulfilledAt: ts("fulfilled_at"),
    cancelledAt: ts("cancelled_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
    index("orders_email_idx").on(t.email),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id"),
    variantId: uuid("variant_id"),
    name: text("name").notNull(),
    variantTitle: text("variant_title").notNull().default(""),
    sku: text("sku"),
    imagePath: text("image_path"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    discount: integer("discount").notNull().default(0),
    taxRateBp: integer("tax_rate_bp").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    total: integer("total").notNull(),
    fulfilledQuantity: integer("fulfilled_quantity").notNull().default(0),
    refundedQuantity: integer("refunded_quantity").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)],
);

/** timeline of an order: status changes, notes, e-mails, payments */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    /** internal notes are hidden from the customer */
    internal: boolean("internal").notNull().default(true),
    userId: uuid("user_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: created(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    kind: text("kind", { enum: ["charge", "refund"] }).notNull().default("charge"),
    status: text("status", { enum: ["pending", "succeeded", "failed", "cancelled"] }).notNull().default("pending"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("CHF"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_ref_idx").on(t.provider, t.providerRef)],
);

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull().default(""),
  restock: boolean("restock").notNull().default(true),
  items: jsonb("items").$type<{ orderItemId: string; quantity: number }[]>().notNull().default([]),
  providerRef: text("provider_ref"),
  userId: uuid("user_id"),
  createdAt: created(),
});

/** counter for order numbers (one row per sequence) */
export const sequences = pgTable("sequences", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
});
