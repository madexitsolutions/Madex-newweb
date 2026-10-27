/**
 * Portfolio projects of the website. Until something is changed in the
 * dashboard they come from the generated export (src/content/generated);
 * the first change copies the whole list into the store ("projekte"), and
 * from then on the store is the source.
 */
import { z } from "zod";
import { posts as generated, type Block, type Post } from "@/content/posts";
import { read, update } from "./store";

/** `taken` = the generated list was copied in (until then `items` is unused). */
type Data = { items: Post[]; taken?: boolean };
const NAME = "projekte";
const EMPTY: Data = { items: [] };

const byDate = (a: Post, b: Post) => b.date.localeCompare(a.date);

/** Every project, newest first. */
export async function getProjects(): Promise<Post[]> {
  const d = await read<Data>(NAME, EMPTY).catch(() => EMPTY);
  return (d.taken ? d.items : generated).slice().sort(byDate);
}

export async function getProject(slug: string): Promise<Post | undefined> {
  return (await getProjects()).find((p) => p.slug === slug);
}

/* ---------- content as plain text ---------- */

/** "## Titel", "- Punkt", "![Alt](bild)", blank line = new paragraph. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "h" ? `## ${b.text}` : b.type === "li" ? `- ${b.text}` : b.type === "img" ? `![${b.alt}](${b.src})` : b.text))
    .join("\n\n");
}

export function textToBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push({ type: "p", text: para.join(" ") });
      para = [];
    };
    for (const line of lines) {
      const img = line.match(/^!\[(.*?)\]\((\S+?)\)$/);
      if (line.startsWith("## ")) {
        flush();
        out.push({ type: "h", level: 4, text: line.slice(3).trim() });
      } else if (/^[-•]\s+/.test(line)) {
        flush();
        out.push({ type: "li", text: line.replace(/^[-•]\s+/, "") });
      } else if (img) {
        flush();
        out.push({ type: "img", alt: img[1], src: img[2] });
      } else para.push(line);
    }
    flush();
  }
  return out;
}

/* ---------- changes from the dashboard ---------- */

export const projectInput = z.object({
  original: z.string().max(200).default(""),
  title: z.string().trim().min(5, "Bitte einen Titel eingeben (mind. 5 Zeichen).").max(200),
  client: z.string().trim().min(2, "Bitte den Kunden angeben.").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(140, "Die Adresse ist zu lang (max. 140 Zeichen).")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Die Adresse darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten, z. B. muster-ag-neue-website."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum wählen."),
  description: z.string().trim().max(500, "Die Kurzbeschreibung ist zu lang (max. 500 Zeichen).").default(""),
  external: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Die Website-Adresse muss mit https:// beginnen.")
    .default(""),
  cover: z.string().trim().min(1, "Bitte ein Titelbild wählen – es erscheint in der Übersicht und oben auf der Projektseite.").max(500),
  content: z.string().max(40_000, "Der Text ist zu lang (max. 40'000 Zeichen).").default(""),
});

/** Slugs the website uses itself – a project must not take them. */
const RESERVED = new Set(["admin", "api", "analyse", "kontakt", "agb", "datenschutz", "portfolio", "website-portfolio", "partners", "karriere", "das-team", "uber-uns", "marketing-solutions", "kostenlose-prufung", "graphic-design-portfolio", "werbevideos-portfolio", "uploads", "media"]);

export type SaveResult = { ok: true; slug: string } | { ok: false; field: string; message: string };

export async function saveProject(v: z.output<typeof projectInput>): Promise<SaveResult> {
  if (RESERVED.has(v.slug)) return { ok: false, field: "slug", message: `«${v.slug}» ist eine feste Seite der Website. Bitte eine andere Adresse wählen.` };
  return update<Data, SaveResult>(NAME, EMPTY, (d) => {
    // first change: take over the generated list
    if (!d.taken) Object.assign(d, { items: structuredClone(generated), taken: true });
    if (v.slug !== v.original && d.items.some((p) => p.slug === v.slug)) return { ok: false, field: "slug", message: "Diese Adresse hat bereits ein anderes Projekt." };
    const prev = v.original ? d.items.find((p) => p.slug === v.original) : undefined;
    const blocks = textToBlocks(v.content);
    const firstImage = blocks.find((b): b is Extract<Block, { type: "img" }> => b.type === "img")?.src;
    const next: Post = {
      slug: v.slug,
      legacySlug: prev?.legacySlug ?? v.slug,
      title: v.title,
      client: v.client,
      date: v.date,
      category: "website-portfolio",
      tags: prev?.tags ?? [],
      description: v.description || (blocks.find((b) => b.type === "p") as { text: string } | undefined)?.text.slice(0, 300) || v.title,
      image: firstImage ?? v.cover,
      cover: v.cover,
      external: v.external,
      blocks,
    };
    d.items = prev ? d.items.map((p) => (p === prev ? next : p)) : [next, ...d.items];
    return { ok: true, slug: next.slug };
  });
}

export async function deleteProject(slug: string) {
  await update<Data>(NAME, EMPTY, (d) => {
    if (!d.taken) Object.assign(d, { items: structuredClone(generated), taken: true });
    d.items = d.items.filter((p) => p.slug !== slug);
  });
}
