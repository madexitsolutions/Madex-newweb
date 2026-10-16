import type { SeoPage } from "@/lib/seo-pages";
import type { SeoOverride } from "@/lib/server/settings";

export const TITLE_MAX = 60;
export const DESC_MAX = 160;
export const DESC_MIN = 70;

/** Title as Google shows it: the brand suffix is added on every page except the home page. */
export const fullTitle = (path: string, title: string) => (path === "/" ? title : `${title} | Madex IT Solutions`);

export function evaluate(page: SeoPage, o?: SeoOverride) {
  const title = fullTitle(page.path, o?.title || page.title);
  const description = o?.description || page.description;
  const titleLong = title.length > TITLE_MAX;
  const descLong = description.length > DESC_MAX;
  const descShort = description.trim().length < DESC_MIN;
  return {
    title,
    description,
    custom: Boolean(o),
    noindex: Boolean(o?.noindex),
    titleLong,
    descLong,
    descShort,
    problems: Number(titleLong) + Number(descLong) + Number(descShort),
  };
}
