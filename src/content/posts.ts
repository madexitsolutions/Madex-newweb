import raw from "./generated/posts.json";

export type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; text: string; links?: string[] }
  | { type: "li"; text: string; links?: string[] }
  | { type: "img"; src: string; alt: string };

export type Post = {
  slug: string;
  legacySlug: string;
  title: string;
  client: string;
  date: string;
  category: "website-portfolio";
  tags: string[];
  description: string;
  image: string;
  cover: string;
  external: string;
  blocks: Block[];
};

// the old blog articles stay in the generated export but are no longer published
// (their URLs redirect to the matching service pages, see next.config.ts)
export const posts = (raw as (Omit<Post, "category"> & { category: string })[]).filter((p): p is Post => p.category === "website-portfolio");
export const projects = posts;

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric" }).format(new Date(iso));
}
