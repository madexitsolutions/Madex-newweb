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
  category: "blog" | "website-portfolio";
  tags: string[];
  description: string;
  image: string;
  cover: string;
  external: string;
  blocks: Block[];
};

export const posts = raw as Post[];
export const projects = posts.filter((p) => p.category === "website-portfolio");
export const blogPosts = posts.filter((p) => p.category === "blog");

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("de-CH", { month: "long", year: "numeric" }).format(new Date(iso));
}
