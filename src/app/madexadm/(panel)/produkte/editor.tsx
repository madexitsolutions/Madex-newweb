"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Icon } from "@/components/admin/kit";
import { RichText } from "@/components/admin/rich-text";
import { CategoryPicker, SeoFields, type TreeChoice } from "@/components/admin/shop-ui";
import type { FormState } from "@/lib/form-state";
import { centsToInput, slugify } from "@/lib/format";
import { PRODUCT_STATUS, PRODUCT_TYPES, STATUS_LABEL, TYPE_LABEL, variantCombinations, variantKey, variantTitle, type ProductStatus, type ProductType } from "@/lib/catalog";
import { saveProductAction, uploadProductImagesAction } from "./actions";

export type EditorProduct = {
  id: string | null;
  name: string;
  slug: string;
  status: ProductStatus;
  type: ProductType;
  shortDescription: string;
  description: string;
  vendor: string;
  tags: string[];
  featured: boolean;
  taxClassId: string | null;
  seoTitle: string;
  seoDescription: string;
  categoryIds: string[];
  images: { mediaId: string; url: string; alt: string }[];
  options: { name: string; values: string[] }[];
  variants: {
    id?: string;
    optionValues: string[];
    sku: string | null;
    barcode: string | null;
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
    stock: number;
    trackInventory: boolean;
    allowBackorder: boolean;
    weightGrams: number | null;
    imageId: string | null;
    active: boolean;
  }[];
};

type Row = {
  key: string;
  id?: string;
  optionValues: string[];
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stock: string;
  stockOriginal: number | null;
  trackInventory: boolean;
  allowBackorder: boolean;
  weightGrams: string;
  imageId: string | null;
  active: boolean;
};

type OptionDraft = { name: string; values: string };

const toRow = (v: EditorProduct["variants"][number]): Row => ({
  key: v.id ?? variantKey(v.optionValues),
  id: v.id,
  optionValues: v.optionValues,
  sku: v.sku ?? "",
  barcode: v.barcode ?? "",
  price: centsToInput(v.price),
  compareAtPrice: centsToInput(v.compareAtPrice),
  costPrice: centsToInput(v.costPrice),
  stock: String(v.stock),
  stockOriginal: v.id ? v.stock : null,
  trackInventory: v.trackInventory,
  allowBackorder: v.allowBackorder,
  weightGrams: v.weightGrams === null ? "" : String(v.weightGrams),
  imageId: v.imageId,
  active: v.active,
});

const blankRow = (optionValues: string[], template?: Row): Row => ({
  key: `${variantKey(optionValues)}-${Math.random().toString(36).slice(2, 7)}`,
  optionValues,
  sku: "",
  barcode: "",
  price: template?.price ?? "",
  compareAtPrice: template?.compareAtPrice ?? "",
  costPrice: template?.costPrice ?? "",
  stock: "0",
  stockOriginal: null,
  trackInventory: template?.trackInventory ?? true,
  allowBackorder: template?.allowBackorder ?? false,
  weightGrams: template?.weightGrams ?? "",
  imageId: null,
  active: true,
});

const parseValues = (s: string) => [...new Map(s.split(",").map((v) => v.trim()).filter(Boolean).map((v) => [v.toLowerCase(), v])).values()];

export function ProductEditor({
  product,
  taxClasses,
  tree,
  shopBase,
  lowStock,
  pricesIncludeTax,
}: {
  product: EditorProduct;
  taxClasses: { id: string; name: string; rateBp: number; isDefault: boolean }[];
  tree: TreeChoice[];
  shopBase: string;
  lowStock: number;
  pricesIncludeTax: boolean;
}) {
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(product.id));
  const [status, setStatus] = useState(product.status);
  const [short, setShort] = useState(product.shortDescription);
  const [seoTitle, setSeoTitle] = useState(product.seoTitle);
  const [seoDesc, setSeoDesc] = useState(product.seoDescription);
  const [images, setImages] = useState(product.images);
  const [hasVariants, setHasVariants] = useState(product.options.length > 0);
  const [options, setOptions] = useState<OptionDraft[]>(product.options.length ? product.options.map((o) => ({ name: o.name, values: o.values.join(", ") })) : [{ name: "Grösse", values: "" }]);
  const [rows, setRows] = useState<Row[]>(() => (product.variants.length ? product.variants.map(toRow) : [blankRow([])]));
  const [open, setOpen] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const parsedOptions = useMemo(() => (hasVariants ? options.map((o) => ({ name: o.name.trim(), values: parseValues(o.values) })).filter((o) => o.name && o.values.length) : []), [options, hasVariants]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Brings the variant rows in line with the options (keeps data of unchanged combinations). */
  const syncVariants = (draft: OptionDraft[]) => {
    const opts = draft.map((o) => ({ name: o.name.trim(), values: parseValues(o.values) })).filter((o) => o.name && o.values.length);
    if (!opts.length) return;
    const combos = variantCombinations(opts);
    const template = rows[0];
    setRows((prev) => {
      const byKey = new Map(prev.map((r) => [variantKey(r.optionValues), r]));
      // a former single variant becomes the first combination (keeps its id, stock and history)
      const single = prev.length === 1 && prev[0].optionValues.length === 0 ? prev[0] : null;
      return combos.map((c, i) => {
        const hit = byKey.get(variantKey(c));
        if (hit) return { ...hit, optionValues: c };
        // option added: rows with the old (shorter) combination keep their data
        const prefix = prev.find((r) => r.optionValues.length < c.length && r.optionValues.every((v, k) => v.toLowerCase() === c[k].toLowerCase()) && !combos.slice(0, i).some((x) => variantKey(x.slice(0, r.optionValues.length)) === variantKey(r.optionValues)));
        if (prefix) return { ...prefix, optionValues: c };
        if (single && i === 0) return { ...single, optionValues: c };
        return blankRow(c, template);
      });
    });
  };

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    try {
      const res = await uploadProductImagesAction(fd);
      if (res.images?.length) {
        setImages((prev) => [...prev, ...res.images!.map((i) => ({ ...i, alt: i.alt || name }))]);
        setDirty(true);
      }
      if (res.error) setUploadError(res.error);
    } catch {
      setUploadError("Der Upload ist fehlgeschlagen. Prüfen Sie die Verbindung und versuchen Sie es erneut.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const move = (i: number, d: -1 | 1) =>
    setImages((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const variantsJson = JSON.stringify(
    (hasVariants ? rows : rows.slice(0, 1)).map((r) => ({
      id: r.id,
      optionValues: hasVariants ? r.optionValues : [],
      sku: r.sku,
      barcode: r.barcode,
      price: r.price,
      compareAtPrice: r.compareAtPrice,
      costPrice: r.costPrice,
      stock: r.stock,
      stockOriginal: r.stockOriginal,
      trackInventory: r.trackInventory,
      allowBackorder: r.allowBackorder,
      weightGrams: r.weightGrams,
      imageId: r.imageId,
      active: hasVariants ? r.active : true,
    })),
  );
  const simple = rows[0];
  const tax = taxClasses.find((t) => t.isDefault);
  const url = `${shopBase}/produkt/${effectiveSlug || "…"}`;

  return (
    <ActionForm action={saveProductAction} className="s-editorform">
      {(state: FormState) => {
        const fe = state?.fieldErrors ?? {};
        const err = (k: string) => (fe[k] ? <span className="a-field__error">{fe[k]}</span> : null);
        const rowErr = (i: number) => Object.entries(fe).filter(([k]) => k.startsWith(`variants.${i}.`));
        return (
          <div onChange={() => setDirty(true)}>
            {product.id && <input type="hidden" name="id" value={product.id} />}
            <input type="hidden" name="images" value={JSON.stringify(images.map((i) => ({ mediaId: i.mediaId, alt: i.alt })))} />
            <input type="hidden" name="options" value={JSON.stringify(parsedOptions)} />
            <input type="hidden" name="variants" value={variantsJson} />
            <input type="hidden" name="slug" value={effectiveSlug} />

            <div className="s-editor">
              <div className="s-editor__main">
                <section className="a-panel">
                  <div className="a-stack">
                    <label className="a-field">
                      <span>Produktname</span>
                      <input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} placeholder="z. B. Hoodie Bergsee" aria-invalid={fe.name ? true : undefined} autoFocus={!product.id} />
                      {err("name")}
                    </label>
                    <label className="a-field">
                      <span>
                        Adresse im Shop <em>wird aus dem Namen erzeugt</em>
                      </span>
                      <div className="s-slug">
                        <span className="s-slug__prefix" title={`${shopBase}/produkt/`}>
                          /produkt/
                        </span>
                        <input
                          value={effectiveSlug}
                          onChange={(e) => {
                            setSlugTouched(true);
                            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
                          }}
                          onBlur={() => setSlug(slugify(effectiveSlug))}
                          aria-label="Adresse im Shop"
                          aria-invalid={fe.slug ? true : undefined}
                          maxLength={120}
                        />
                      </div>
                      {fe.slug ? err("slug") : product.id && product.slug !== effectiveSlug ? <small className="a-warn">Achtung: Bestehende Links auf die alte Adresse funktionieren danach nicht mehr.</small> : null}
                    </label>
                    <label className="a-field">
                      <span>
                        Kurzbeschreibung <em>{short.length} / 1000</em>
                      </span>
                      <textarea name="shortDescription" rows={2} value={short} onChange={(e) => setShort(e.target.value)} maxLength={1000} placeholder="Ein bis zwei Sätze für Übersichten und Vorschauen" />
                    </label>
                    <RichText name="description" label="Beschreibung" defaultValue={product.description} help="Formatierung wird beim Speichern bereinigt. Eingefügter Text wird ohne Formatierung übernommen." />
                  </div>
                </section>

                <section className="a-panel" aria-labelledby="bilder-h">
                  <div className="a-panel__head">
                    <div>
                      <h2 id="bilder-h">Bilder</h2>
                      <p className="a-panel__desc">Das erste Bild ist das Hauptbild. Der Alternativtext beschreibt das Bild für Screenreader und Google.</p>
                    </div>
                  </div>
                  {uploadError && (
                    <p className="a-alert a-alert--error" role="alert" style={{ marginBottom: 12 }}>
                      {uploadError}
                    </p>
                  )}
                  <div className="s-images">
                    {images.map((img, i) => (
                      <div className="s-img" key={img.mediaId}>
                        <div className="s-img__pic">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.alt} />
                          {i === 0 && <span className="s-img__badge">Hauptbild</span>}
                        </div>
                        <div className="s-img__body">
                          <input
                            value={img.alt}
                            onChange={(e) => setImages((prev) => prev.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))}
                            placeholder="Alternativtext"
                            aria-label={`Alternativtext Bild ${i + 1}`}
                            maxLength={300}
                          />
                          <div className="s-img__tools">
                            <span>
                              <button type="button" className="s-iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Bild ${i + 1} nach vorne`} title="Nach vorne">
                                <Icon name="back" size={16} />
                              </button>{" "}
                              <button type="button" className="s-iconbtn" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label={`Bild ${i + 1} nach hinten`} title="Nach hinten">
                                <Icon name="arrow" size={16} />
                              </button>
                            </span>
                            <button
                              type="button"
                              className="s-iconbtn s-iconbtn--danger"
                              onClick={() => {
                                setImages((prev) => prev.filter((_, k) => k !== i));
                                setRows((prev) => prev.map((r) => (r.imageId === img.mediaId ? { ...r, imageId: null } : r)));
                                setDirty(true);
                              }}
                              aria-label={`Bild ${i + 1} entfernen`}
                              title="Entfernen"
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <label
                      className={`s-drop${over ? " is-over" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOver(true);
                      }}
                      onDragLeave={() => setOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setOver(false);
                        void upload(e.dataTransfer.files);
                      }}
                    >
                      <Icon name="upload" size={22} />
                      <span>
                        <strong>{uploading ? "Wird hochgeladen …" : "Bilder hinzufügen"}</strong>
                        <br />
                        <small>Hierher ziehen oder klicken · JPG, PNG, WebP bis 10 MB</small>
                      </span>
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={(e) => e.target.files && void upload(e.target.files)} disabled={uploading} />
                    </label>
                  </div>
                </section>

                <section className="a-panel" aria-labelledby="preis-h">
                  <div className="a-panel__head">
                    <div>
                      <h2 id="preis-h">{hasVariants ? "Optionen und Varianten" : "Preis und Lager"}</h2>
                      <p className="a-panel__desc">Preise {pricesIncludeTax ? "inkl." : "exkl."} MWST in CHF, z. B. 29.90.</p>
                    </div>
                  </div>
                  <label className="a-check a-check--box" style={{ marginBottom: 16 }}>
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => {
                        if (!e.target.checked && rows.length > 1 && !confirm(`Ohne Optionen bleibt nur die erste Variante «${variantTitle(rows[0].optionValues)}» erhalten. Fortfahren?`)) return;
                        setHasVariants(e.target.checked);
                        if (e.target.checked) syncVariants(options);
                        else setRows((prev) => [{ ...prev[0], optionValues: [] }]);
                      }}
                    />
                    <span>
                      Dieses Produkt hat Varianten
                      <small>z. B. verschiedene Grössen oder Farben mit eigenem Preis, Lager und Artikelnummer</small>
                    </span>
                  </label>

                  {!hasVariants ? (
                    <div className="a-stack">
                      <div className="a-fields3">
                        <label className="a-field">
                          <span>Preis</span>
                          <input inputMode="decimal" value={simple.price} onChange={(e) => update(simple.key, { price: e.target.value })} placeholder="0.00" aria-invalid={fe["variants.0.price"] ? true : undefined} />
                          {err("variants.0.price")}
                        </label>
                        <label className="a-field">
                          <span>
                            Vergleichspreis <em>optional</em>
                          </span>
                          <input inputMode="decimal" value={simple.compareAtPrice} onChange={(e) => update(simple.key, { compareAtPrice: e.target.value })} placeholder="Früherer Preis" aria-invalid={fe["variants.0.compareAtPrice"] ? true : undefined} />
                          {err("variants.0.compareAtPrice")}
                        </label>
                        <label className="a-field">
                          <span>
                            Einkaufspreis <em>intern</em>
                          </span>
                          <input inputMode="decimal" value={simple.costPrice} onChange={(e) => update(simple.key, { costPrice: e.target.value })} placeholder="0.00" aria-invalid={fe["variants.0.costPrice"] ? true : undefined} />
                          {err("variants.0.costPrice")}
                        </label>
                      </div>
                      <div className="a-fields3">
                        <label className="a-field">
                          <span>Artikelnummer (SKU)</span>
                          <input value={simple.sku} onChange={(e) => update(simple.key, { sku: e.target.value })} maxLength={100} aria-invalid={fe["variants.0.sku"] ? true : undefined} />
                          {err("variants.0.sku")}
                        </label>
                        <label className="a-field">
                          <span>Barcode (EAN/GTIN)</span>
                          <input value={simple.barcode} onChange={(e) => update(simple.key, { barcode: e.target.value })} maxLength={100} inputMode="numeric" />
                        </label>
                        <label className="a-field">
                          <span>
                            Gewicht <em>Gramm</em>
                          </span>
                          <input inputMode="numeric" value={simple.weightGrams} onChange={(e) => update(simple.key, { weightGrams: e.target.value })} placeholder="z. B. 350" aria-invalid={fe["variants.0.weightGrams"] ? true : undefined} />
                          {err("variants.0.weightGrams")}
                        </label>
                      </div>
                      <label className="a-check">
                        <input type="checkbox" checked={simple.trackInventory} onChange={(e) => update(simple.key, { trackInventory: e.target.checked })} />
                        <span>
                          Lagerbestand verwalten
                          <small>Der Bestand sinkt mit jeder Bestellung. Ohne Häkchen gilt das Produkt immer als verfügbar.</small>
                        </span>
                      </label>
                      {simple.trackInventory && (
                        <div className="a-fields2">
                          <label className="a-field">
                            <span>Lagerbestand</span>
                            <input inputMode="numeric" value={simple.stock} onChange={(e) => update(simple.key, { stock: e.target.value })} aria-invalid={fe["variants.0.stock"] ? true : undefined} />
                            {err("variants.0.stock")}
                            {Number(simple.stock) <= lowStock && <small className="s-stock--low">Niedriger Bestand (Grenze {lowStock})</small>}
                          </label>
                          <label className="a-check a-check--inline">
                            <input type="checkbox" checked={simple.allowBackorder} onChange={(e) => update(simple.key, { allowBackorder: e.target.checked })} />
                            <span>
                              Bestellen trotz Ausverkauf erlauben
                              <small>Kunden können nachbestellen, der Bestand wird negativ.</small>
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="a-stack">
                      <div className="s-options">
                        {options.map((o, i) => (
                          <div className="s-option" key={i}>
                            <label className="a-field">
                              <span>Option {i + 1}</span>
                              <input
                                value={o.name}
                                onChange={(e) => setOptions((prev) => prev.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                                onBlur={() => syncVariants(options)}
                                placeholder={["Grösse", "Farbe", "Material"][i]}
                                maxLength={50}
                                aria-invalid={fe[`options.${i}.name`] ? true : undefined}
                              />
                            </label>
                            <label className="a-field">
                              <span>
                                Werte <em>durch Komma getrennt</em>
                              </span>
                              <input
                                value={o.values}
                                onChange={(e) => setOptions((prev) => prev.map((x, k) => (k === i ? { ...x, values: e.target.value } : x)))}
                                onBlur={() => syncVariants(options)}
                                placeholder={["S, M, L, XL", "Rot, Blau, Grün", "Baumwolle, Leinen"][i]}
                              />
                            </label>
                            <button
                              type="button"
                              className="s-iconbtn s-iconbtn--danger"
                              aria-label={`Option ${o.name || i + 1} entfernen`}
                              disabled={options.length === 1}
                              onClick={() => {
                                const next = options.filter((_, k) => k !== i);
                                setOptions(next);
                                setRows((prev) => {
                                  // drop the value of the removed option, keep the first row per remaining combination
                                  const seen = new Set<string>();
                                  return prev
                                    .map((r) => ({ ...r, optionValues: r.optionValues.filter((_, k) => k !== i) }))
                                    .filter((r) => {
                                      const k = variantKey(r.optionValues);
                                      if (seen.has(k)) return false;
                                      seen.add(k);
                                      return true;
                                    });
                                });
                              }}
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {fe.options && <span className="a-field__error">{fe.options}</span>}
                      <div className="a-inline">
                        {options.length < 3 && (
                          <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setOptions((prev) => [...prev, { name: "", values: "" }])}>
                            <Icon name="plus" size={15} />
                            Option hinzufügen
                          </button>
                        )}
                        <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => syncVariants(options)}>
                          <Icon name="refresh" size={15} />
                          Varianten erzeugen
                        </button>
                        <span className="a-muted a-small0">{parsedOptions.length ? `${variantCombinations(parsedOptions).length} Kombinationen` : "Geben Sie Optionen und Werte ein."}</span>
                      </div>

                      {parsedOptions.length > 0 && rows.length > 1 && <ApplyAll onApply={(field, value) => setRows((prev) => prev.map((r) => ({ ...r, [field]: value })))} />}

                      {parsedOptions.length > 0 && rows[0]?.optionValues.length > 0 && (
                        <div className="s-variants" role="table" aria-label="Varianten">
                          <div className="s-variants__head" role="row">
                            <span role="columnheader">
                              <span className="sr-only">Bild</span>
                            </span>
                            <span role="columnheader">Variante</span>
                            <span role="columnheader">Preis CHF</span>
                            <span role="columnheader">Lager</span>
                            <span role="columnheader">Artikelnummer</span>
                            <span role="columnheader">
                              <span className="sr-only">Details</span>
                            </span>
                          </div>
                          {rows.map((r, i) => {
                            const img = images.find((x) => x.mediaId === r.imageId);
                            const errs = rowErr(i);
                            const isOpen = open === r.key || errs.some(([k]) => !/\.(price|stock|sku)$/.test(k));
                            const t = variantTitle(r.optionValues);
                            return (
                              <div className={`s-variant${r.active ? "" : " is-off"}`} key={r.key} role="row">
                                <div className="s-variant__row">
                                  <span role="cell">
                                    {img ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={img.url} alt="" className="s-variant__thumb" />
                                    ) : (
                                      <span className="s-variant__thumb" aria-hidden="true">
                                        <Icon name="image" size={16} />
                                      </span>
                                    )}
                                  </span>
                                  <span className="s-variant__title" role="cell">
                                    {t}
                                    <small>{!r.active ? "Deaktiviert" : !r.id ? "Neu" : r.trackInventory ? (Number(r.stock) <= 0 ? "Ausverkauft" : Number(r.stock) <= lowStock ? "Wenig an Lager" : "") : "Lager nicht erfasst"}</small>
                                  </span>
                                  <label className="s-inl" role="cell">
                                    <span>Preis CHF</span>
                                    <input inputMode="decimal" value={r.price} onChange={(e) => update(r.key, { price: e.target.value })} aria-label={`Preis ${t}`} aria-invalid={fe[`variants.${i}.price`] ? true : undefined} placeholder="0.00" />
                                  </label>
                                  <label className="s-inl" role="cell">
                                    <span>Lager</span>
                                    <input inputMode="numeric" value={r.trackInventory ? r.stock : "–"} disabled={!r.trackInventory} onChange={(e) => update(r.key, { stock: e.target.value })} aria-label={`Lagerbestand ${t}`} aria-invalid={fe[`variants.${i}.stock`] ? true : undefined} />
                                  </label>
                                  <label className="s-inl" role="cell">
                                    <span>Art.-Nr.</span>
                                    <input value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} aria-label={`Artikelnummer ${t}`} aria-invalid={fe[`variants.${i}.sku`] ? true : undefined} maxLength={100} />
                                  </label>
                                  <span role="cell">
                                    <button type="button" className="s-iconbtn" aria-expanded={isOpen} aria-label={`Weitere Felder für ${t}`} onClick={() => setOpen(isOpen ? null : r.key)} title="Weitere Felder">
                                      <Icon name={isOpen ? "close" : "dots"} size={16} />
                                    </button>
                                  </span>
                                </div>
                                {errs.length > 0 && <p className="s-variant__err">{errs.map(([, m]) => m).join(" ")}</p>}
                                {isOpen && (
                                  <div className="s-variant__details">
                                    <label className="a-field">
                                      <span>Vergleichspreis</span>
                                      <input inputMode="decimal" value={r.compareAtPrice} onChange={(e) => update(r.key, { compareAtPrice: e.target.value })} placeholder="Früherer Preis" aria-invalid={fe[`variants.${i}.compareAtPrice`] ? true : undefined} />
                                    </label>
                                    <label className="a-field">
                                      <span>Einkaufspreis</span>
                                      <input inputMode="decimal" value={r.costPrice} onChange={(e) => update(r.key, { costPrice: e.target.value })} />
                                    </label>
                                    <label className="a-field">
                                      <span>Barcode</span>
                                      <input value={r.barcode} onChange={(e) => update(r.key, { barcode: e.target.value })} maxLength={100} />
                                    </label>
                                    <label className="a-field">
                                      <span>Gewicht (g)</span>
                                      <input inputMode="numeric" value={r.weightGrams} onChange={(e) => update(r.key, { weightGrams: e.target.value })} aria-invalid={fe[`variants.${i}.weightGrams`] ? true : undefined} />
                                    </label>
                                    <label className="a-field" style={{ gridColumn: "span 2" }}>
                                      <span>Bild der Variante</span>
                                      <select value={r.imageId ?? ""} onChange={(e) => update(r.key, { imageId: e.target.value || null })} disabled={!images.length}>
                                        <option value="">{images.length ? "Hauptbild des Produkts" : "Zuerst Bilder hinzufügen"}</option>
                                        {images.map((im, k) => (
                                          <option key={im.mediaId} value={im.mediaId}>
                                            Bild {k + 1}
                                            {im.alt ? ` – ${im.alt.slice(0, 40)}` : ""}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="s-variant__checks">
                                      <label className="a-check">
                                        <input type="checkbox" checked={r.trackInventory} onChange={(e) => update(r.key, { trackInventory: e.target.checked })} />
                                        <span>Lager verwalten</span>
                                      </label>
                                      <label className="a-check">
                                        <input type="checkbox" checked={r.allowBackorder} disabled={!r.trackInventory} onChange={(e) => update(r.key, { allowBackorder: e.target.checked })} />
                                        <span>Bestellen trotz Ausverkauf</span>
                                      </label>
                                      <label className="a-check">
                                        <input type="checkbox" checked={r.active} onChange={(e) => update(r.key, { active: e.target.checked })} />
                                        <span>Im Shop verfügbar</span>
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="a-panel" aria-labelledby="seo-h">
                  <div className="a-panel__head">
                    <div>
                      <h2 id="seo-h">Suchmaschinen</h2>
                      <p className="a-panel__desc">So erscheint das Produkt in Google.</p>
                    </div>
                  </div>
                  <SeoFields title={seoTitle} description={seoDesc} onTitle={setSeoTitle} onDescription={setSeoDesc} fallbackTitle={name} fallbackDescription={short} url={url} errors={fe} />
                </section>
              </div>

              <aside className="s-editor__side">
                <section className="a-panel">
                  <h2>Status</h2>
                  <div className="a-stack" style={{ marginTop: 12 }}>
                    <label className="a-field">
                      <span className="sr-only">Status</span>
                      <select name="status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
                        {PRODUCT_STATUS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <small>{status === "active" ? "Sichtbar und bestellbar im Shop." : status === "draft" ? "Nicht sichtbar. Zum Vorbereiten." : "Nicht mehr sichtbar, bleibt in Bestellungen erhalten."}</small>
                    </label>
                    <label className="a-check">
                      <input type="checkbox" name="featured" defaultChecked={product.featured} />
                      <span>
                        Hervorgehoben
                        <small>z. B. auf der Startseite zeigen</small>
                      </span>
                    </label>
                  </div>
                </section>
                <section className="a-panel">
                  <h2>Einordnung</h2>
                  <div className="a-stack" style={{ marginTop: 12 }}>
                    <label className="a-field">
                      <span>Produkttyp</span>
                      <select name="type" defaultValue={product.type}>
                        {PRODUCT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="a-field">
                      <span id="cat-label">Kategorien</span>
                      <CategoryPicker
                        tree={tree}
                        name="categoryIds"
                        defaultValue={product.categoryIds}
                        emptyHint={
                          <>
                            Noch keine Kategorien. <Link href="/madexadm/kategorien?bearbeiten=neu">Kategorie anlegen</Link>
                          </>
                        }
                      />
                    </div>
                    <label className="a-field">
                      <span>
                        Schlagwörter <em>durch Komma getrennt</em>
                      </span>
                      <input name="tags" defaultValue={product.tags.join(", ")} placeholder="z. B. bio, winter" />
                    </label>
                    <label className="a-field">
                      <span>Hersteller / Marke</span>
                      <input name="vendor" defaultValue={product.vendor} maxLength={120} />
                    </label>
                    <label className="a-field">
                      <span>Steuerklasse (MWST)</span>
                      <select name="taxClassId" defaultValue={product.taxClassId ?? ""}>
                        <option value="">Standard{tax ? ` (${tax.name}, ${(tax.rateBp / 100).toLocaleString("de-CH")} %)` : ""}</option>
                        {taxClasses
                          .filter((t) => !t.isDefault)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({(t.rateBp / 100).toLocaleString("de-CH")} %)
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                </section>
              </aside>
            </div>

            <div className="s-editbar">
              <span className={`s-editbar__msg${dirty ? " is-dirty" : ""}`} aria-live="polite">
                {dirty ? "Ungespeicherte Änderungen" : product.id ? "Alle Änderungen gespeichert" : "Neues Produkt"}
              </span>
              <div className="s-editbar__end">
                <Link href="/madexadm/produkte" className="a-btn a-btn--ghost">
                  {dirty ? "Verwerfen" : "Zurück"}
                </Link>
                <Submit>{product.id ? "Speichern" : "Produkt erstellen"}</Submit>
              </div>
            </div>
          </div>
        );
      }}
    </ActionForm>
  );
}

function ApplyAll({ onApply }: { onApply: (field: "price" | "stock" | "compareAtPrice", value: string) => void }) {
  const [field, setField] = useState<"price" | "stock" | "compareAtPrice">("price");
  const [value, setValue] = useState("");
  return (
    <div className="s-applyall">
      <label className="a-field">
        <span>Für alle Varianten</span>
        <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>
          <option value="price">Preis</option>
          <option value="compareAtPrice">Vergleichspreis</option>
          <option value="stock">Lagerbestand</option>
        </select>
      </label>
      <label className="a-field">
        <span>Wert</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={field === "stock" ? "z. B. 10" : "z. B. 29.90"} />
      </label>
      <button type="button" className="a-btn a-btn--ghost" disabled={!value.trim()} onClick={() => onApply(field, value.trim())}>
        Übernehmen
      </button>
    </div>
  );
}
