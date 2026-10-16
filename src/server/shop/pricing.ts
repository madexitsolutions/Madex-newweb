/**
 * Price engine (pure – no database access): line totals, coupon discounts,
 * shipping methods for a destination, Swiss VAT per rate and grand total.
 *
 * Used by the cart, the checkout (server-side re-pricing), manual orders and
 * the public API, so every total shown anywhere comes from here.
 *
 * Conventions
 * - Money in Rappen (integers), tax rates in basis points (8.1 % = 810).
 * - `pricesIncludeTax = true` (B2C default): unit prices and shipping are gross,
 *   VAT is extracted (tax = gross × rate / (1 + rate)); total = subtotal − discount + shipping.
 * - `pricesIncludeTax = false`: prices are net, VAT is added on top; total = … + tax.
 * - Discounts are spread over the eligible lines in proportion to their value
 *   (largest-remainder method, so the parts add up exactly) and VAT is computed
 *   on the discounted line totals.
 * - VAT is computed once per rate on the rate's total (no accumulation of
 *   per-line rounding differences) and then allocated back to the lines.
 * - Shipping without its own tax class follows the goods: it is allocated to
 *   the VAT rates in proportion to the goods value per rate (ESTV practice for
 *   ancillary costs). With a tax class it is taxed at that rate.
 */
import { date, money } from "@/lib/format";
import { taxFromGross, taxOnNet } from "./tax";

/* ------------------------------------------------------------------ inputs */

export type PricingLineInput = {
  /** stable key to map results back (cart item id, variant id …) */
  key: string;
  productId: string;
  variantId?: string | null;
  categoryIds?: string[];
  unitPrice: number;
  quantity: number;
  taxRateBp: number;
  weightGrams?: number | null;
  /** false for digital products and services (no shipping needed) */
  requiresShipping?: boolean;
};

export type CouponInput = {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  /** percent in basis points (10 % = 1000) or a fixed amount in Rappen */
  value: number;
  minSubtotal?: number | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  usedCount?: number;
  productIds?: string[];
  categoryIds?: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  active?: boolean;
};

export type ShippingZoneInput = { id: string; name: string; countries: string[]; sort?: number };

export type ShippingMethodInput = {
  id: string;
  zoneId: string;
  name: string;
  description?: string;
  type: "flat" | "free" | "pickup" | "weight";
  price: number;
  freeAbove?: number | null;
  weightRates?: { upToGrams: number; price: number }[];
  minSubtotal?: number | null;
  deliveryDaysMin?: number | null;
  deliveryDaysMax?: number | null;
  /** rate of the method's tax class; null = follows the goods */
  taxRateBp?: number | null;
  active?: boolean;
  sort?: number;
};

export type PricingInput = {
  lines: PricingLineInput[];
  pricesIncludeTax: boolean;
  coupon?: CouponInput | null;
  /** how often this customer (account or e-mail) already used the coupon */
  couponCustomerUses?: number;
  /** destination country (ISO alpha-2); without it no shipping is priced */
  country?: string | null;
  shippingMethodId?: string | null;
  zones?: ShippingZoneInput[];
  methods?: ShippingMethodInput[];
  /** rate for shipping when there are no goods to follow (default 8.1 %) */
  defaultTaxRateBp?: number;
  now?: Date;
};

/* ----------------------------------------------------------------- outputs */

export type PricedLine = {
  key: string;
  productId: string;
  variantId: string | null;
  unitPrice: number;
  quantity: number;
  taxRateBp: number;
  /** unitPrice × quantity */
  subtotal: number;
  /** share of the coupon discount */
  discount: number;
  /** subtotal − discount (gross or net like the prices) */
  total: number;
  tax: number;
};

export type ShippingOption = {
  id: string;
  zoneId: string;
  zoneName: string;
  name: string;
  description: string;
  type: ShippingMethodInput["type"];
  /** price to pay (after "free above" and free-shipping coupons) */
  price: number;
  /** price before free-shipping rules */
  basePrice: number;
  free: boolean;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  taxRateBp: number | null;
};

export type TaxLine = { rateBp: number; net: number; tax: number; gross: number };

export type PricingResult = {
  currency: "CHF";
  pricesIncludeTax: boolean;
  lines: PricedLine[];
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  coupon: { code: string; type: CouponInput["type"]; valid: boolean; error: string | null; discount: number; freeShipping: boolean } | null;
  requiresShipping: boolean;
  weightGrams: number;
  shipping: {
    country: string | null;
    zone: { id: string; name: string } | null;
    methods: ShippingOption[];
    selected: ShippingOption | null;
    price: number;
    tax: number;
    error: string | null;
  };
  shippingTotal: number;
  taxTotal: number;
  total: number;
  taxes: TaxLine[];
};

/* ----------------------------------------------------------------- helpers */

/**
 * Splits `total` into integer parts proportional to `weights` (largest
 * remainder). The parts always add up to `total`.
 */
export function distribute(total: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  const w = sum > 0 ? weights.map((x) => Math.max(0, x)) : weights.map(() => 1);
  const wsum = sum > 0 ? sum : weights.length;
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const raw = w.map((x) => (abs * x) / wsum);
  const parts = raw.map(Math.floor);
  let rest = abs - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0 && order.length; k = (k + 1) % order.length, rest--) parts[order[k].i]++;
  return parts.map((p) => p * sign);
}

const norm = (code: string) => code.trim().toUpperCase();

/** Lines a coupon applies to (no restriction = all lines). */
export function couponEligible(coupon: Pick<CouponInput, "productIds" | "categoryIds">, line: Pick<PricingLineInput, "productId" | "categoryIds">) {
  const products = coupon.productIds ?? [];
  const cats = coupon.categoryIds ?? [];
  if (!products.length && !cats.length) return true;
  if (products.includes(line.productId)) return true;
  return (line.categoryIds ?? []).some((c) => cats.includes(c));
}

/**
 * Checks a coupon against the cart. Returns a German error message for the
 * customer, or null when the coupon can be used.
 */
export function validateCoupon(
  coupon: CouponInput | null | undefined,
  ctx: { subtotal: number; lines: Pick<PricingLineInput, "productId" | "categoryIds">[]; customerUses?: number; now?: Date },
): string | null {
  if (!coupon || coupon.active === false) return "Dieser Gutscheincode ist ungültig.";
  const now = ctx.now ?? new Date();
  if (coupon.startsAt && coupon.startsAt > now) return `Dieser Gutschein ist erst ab ${date(coupon.startsAt)} gültig.`;
  if (coupon.endsAt && coupon.endsAt < now) return "Dieser Gutschein ist abgelaufen.";
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && (coupon.usedCount ?? 0) >= coupon.usageLimit) return "Dieser Gutschein wurde bereits so oft eingelöst wie möglich.";
  if (coupon.usageLimitPerCustomer !== null && coupon.usageLimitPerCustomer !== undefined && (ctx.customerUses ?? 0) >= coupon.usageLimitPerCustomer)
    return coupon.usageLimitPerCustomer === 1 ? "Sie haben diesen Gutschein bereits eingelöst." : `Sie haben diesen Gutschein bereits ${coupon.usageLimitPerCustomer}-mal eingelöst.`;
  if (coupon.minSubtotal && ctx.subtotal < coupon.minSubtotal)
    return `Dieser Gutschein gilt ab einem Bestellwert von ${money(coupon.minSubtotal)}. Es fehlen noch ${money(coupon.minSubtotal - ctx.subtotal)}.`;
  if (!ctx.lines.some((l) => couponEligible(coupon, l))) return "Dieser Gutschein gilt nicht für die Produkte in Ihrem Warenkorb.";
  return null;
}

/** Zone for a country: first zone (by sort) listing it, otherwise the "*" (rest of world) zone. */
export function zoneForCountry(zones: ShippingZoneInput[], country: string | null | undefined): ShippingZoneInput | null {
  if (!country) return null;
  const c = country.toUpperCase();
  const sorted = [...zones].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  return sorted.find((z) => z.countries.map((x) => x.toUpperCase()).includes(c)) ?? sorted.find((z) => z.countries.includes("*")) ?? null;
}

/**
 * Shipping methods offered for a destination and cart value.
 * `goodsTotal` is the value after discounts (what "free above" and the
 * minimum order value compare against).
 */
export function shippingOptions(input: {
  zones: ShippingZoneInput[];
  methods: ShippingMethodInput[];
  country: string | null | undefined;
  goodsTotal: number;
  weightGrams: number;
  freeShipping?: boolean;
}): { zone: ShippingZoneInput | null; options: ShippingOption[] } {
  const zone = zoneForCountry(input.zones, input.country);
  if (!zone) return { zone: null, options: [] };
  const options: ShippingOption[] = [];
  const methods = input.methods.filter((m) => m.zoneId === zone.id && m.active !== false).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  for (const m of methods) {
    if (m.minSubtotal && input.goodsTotal < m.minSubtotal) continue;
    let base: number;
    if (m.type === "free") base = 0;
    else if (m.type === "weight") {
      const rates = [...(m.weightRates ?? [])].sort((a, b) => a.upToGrams - b.upToGrams);
      const rate = rates.find((r) => input.weightGrams <= r.upToGrams);
      if (!rate) continue; // too heavy for this method
      base = rate.price;
    } else base = m.price;
    const freeAbove = m.freeAbove !== null && m.freeAbove !== undefined && input.goodsTotal >= m.freeAbove;
    const free = base === 0 || freeAbove || Boolean(input.freeShipping && m.type !== "pickup");
    options.push({
      id: m.id,
      zoneId: zone.id,
      zoneName: zone.name,
      name: m.name,
      description: m.description ?? "",
      type: m.type,
      price: free ? 0 : base,
      basePrice: base,
      free,
      deliveryDaysMin: m.deliveryDaysMin ?? null,
      deliveryDaysMax: m.deliveryDaysMax ?? null,
      taxRateBp: m.taxRateBp ?? null,
    });
  }
  return { zone, options };
}

const taxOf = (amount: number, rateBp: number, includesTax: boolean) => (includesTax ? taxFromGross(amount, rateBp) : taxOnNet(amount, rateBp));

/* -------------------------------------------------------------------- main */

export function priceCart(input: PricingInput): PricingResult {
  const incl = input.pricesIncludeTax;
  const lines = input.lines.filter((l) => l.quantity > 0);
  const subtotals = lines.map((l) => l.unitPrice * l.quantity);
  const subtotal = subtotals.reduce((a, b) => a + b, 0);
  const weightGrams = lines.reduce((a, l) => a + (l.requiresShipping === false ? 0 : (l.weightGrams ?? 0) * l.quantity), 0);
  const requiresShipping = lines.some((l) => l.requiresShipping !== false);

  /* coupon */
  const discounts = lines.map(() => 0);
  let coupon: PricingResult["coupon"] = null;
  if (input.coupon) {
    const c = input.coupon;
    const error = validateCoupon(c, { subtotal, lines, customerUses: input.couponCustomerUses, now: input.now });
    let discount = 0;
    if (!error && c.type !== "free_shipping") {
      const eligible = lines.map((l) => couponEligible(c, l));
      const eligibleSubtotal = subtotals.reduce((a, s, i) => a + (eligible[i] ? s : 0), 0);
      discount = c.type === "percent" ? Math.round((eligibleSubtotal * Math.min(Math.max(c.value, 0), 10_000)) / 10_000) : Math.min(Math.max(c.value, 0), eligibleSubtotal);
      const parts = distribute(
        discount,
        subtotals.map((s, i) => (eligible[i] ? s : 0)),
      );
      parts.forEach((p, i) => (discounts[i] = p));
    }
    coupon = { code: norm(c.code), type: c.type, valid: !error, error, discount, freeShipping: !error && c.type === "free_shipping" };
  }
  const discountTotal = discounts.reduce((a, b) => a + b, 0);
  const lineTotals = subtotals.map((s, i) => s - discounts[i]);
  const goodsTotal = subtotal - discountTotal;

  /* shipping */
  const country = input.country ? input.country.toUpperCase() : null;
  let zone: ShippingZoneInput | null = null;
  let methods: ShippingOption[] = [];
  let selected: ShippingOption | null = null;
  let shippingError: string | null = null;
  if (requiresShipping && country) {
    const res = shippingOptions({ zones: input.zones ?? [], methods: input.methods ?? [], country, goodsTotal, weightGrams, freeShipping: coupon?.freeShipping });
    zone = res.zone;
    methods = res.options;
    if (!methods.length) shippingError = "Für dieses Land ist leider keine Lieferung möglich.";
    else if (input.shippingMethodId) {
      selected = methods.find((m) => m.id === input.shippingMethodId) ?? null;
      if (!selected) shippingError = "Die gewählte Versandart ist für diese Lieferadresse nicht verfügbar. Bitte wählen Sie eine andere.";
    }
  }
  const shippingPrice = selected?.price ?? 0;

  /* VAT: one computation per rate, then allocated back */
  type Part = { kind: "line"; index: number; amount: number } | { kind: "shipping"; amount: number };
  const groups = new Map<number, Part[]>();
  const push = (rate: number, p: Part) => groups.set(rate, [...(groups.get(rate) ?? []), p]);
  lines.forEach((l, i) => push(l.taxRateBp, { kind: "line", index: i, amount: lineTotals[i] }));
  if (shippingPrice > 0) {
    if (selected?.taxRateBp !== null && selected?.taxRateBp !== undefined) push(selected.taxRateBp, { kind: "shipping", amount: shippingPrice });
    else {
      const perRate = new Map<number, number>();
      lines.forEach((l, i) => perRate.set(l.taxRateBp, (perRate.get(l.taxRateBp) ?? 0) + lineTotals[i]));
      const rates = [...perRate.keys()].filter((r) => (perRate.get(r) ?? 0) > 0);
      if (!rates.length) push(input.defaultTaxRateBp ?? 810, { kind: "shipping", amount: shippingPrice });
      else {
        const shares = distribute(
          shippingPrice,
          rates.map((r) => perRate.get(r) ?? 0),
        );
        rates.forEach((r, k) => push(r, { kind: "shipping", amount: shares[k] }));
      }
    }
  }
  const lineTax = lines.map(() => 0);
  let shippingTax = 0;
  const taxes: TaxLine[] = [];
  for (const [rate, parts] of groups) {
    const base = parts.reduce((a, p) => a + p.amount, 0);
    const tax = taxOf(base, rate, incl);
    const alloc = distribute(
      tax,
      parts.map((p) => p.amount),
    );
    parts.forEach((p, k) => {
      if (p.kind === "line") lineTax[p.index] += alloc[k];
      else shippingTax += alloc[k];
    });
    if (base !== 0 || tax !== 0) taxes.push({ rateBp: rate, net: incl ? base - tax : base, tax, gross: incl ? base : base + tax });
  }
  taxes.sort((a, b) => b.rateBp - a.rateBp);
  const taxTotal = taxes.reduce((a, t) => a + t.tax, 0);
  const total = goodsTotal + shippingPrice + (incl ? 0 : taxTotal);

  return {
    currency: "CHF",
    pricesIncludeTax: incl,
    lines: lines.map((l, i) => ({
      key: l.key,
      productId: l.productId,
      variantId: l.variantId ?? null,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      taxRateBp: l.taxRateBp,
      subtotal: subtotals[i],
      discount: discounts[i],
      total: lineTotals[i],
      tax: lineTax[i],
    })),
    itemCount: lines.reduce((a, l) => a + l.quantity, 0),
    subtotal,
    discountTotal,
    coupon,
    requiresShipping,
    weightGrams,
    shipping: { country, zone: zone ? { id: zone.id, name: zone.name } : null, methods, selected, price: shippingPrice, tax: shippingTax, error: shippingError },
    shippingTotal: shippingPrice,
    taxTotal,
    total,
    taxes,
  };
}
