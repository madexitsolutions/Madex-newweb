import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/** One themed 3D scene per page; each is code-split and only loaded where used. */
export const heroScenes = {
  solutions: dynamic(() => import("./solutions"), { ssr: false }),
  web: dynamic(() => import("./web"), { ssr: false }),
  digital: dynamic(() => import("./digital"), { ssr: false }),
  seo: dynamic(() => import("./seo"), { ssr: false }),
  video: dynamic(() => import("./video"), { ssr: false }),
  social: dynamic(() => import("./social"), { ssr: false }),
  google: dynamic(() => import("./google"), { ssr: false }),
  design: dynamic(() => import("./design"), { ssr: false }),
  analysis: dynamic(() => import("./analysis"), { ssr: false }),
  ai: dynamic(() => import("./ai"), { ssr: false }),
  about: dynamic(() => import("./about"), { ssr: false }),
  team: dynamic(() => import("./team"), { ssr: false }),
  blog: dynamic(() => import("./blog"), { ssr: false }),
  career: dynamic(() => import("./career"), { ssr: false }),
  portfolio: dynamic(() => import("./portfolio"), { ssr: false }),
  partners: dynamic(() => import("./partners"), { ssr: false }),
  contact: dynamic(() => import("./contact"), { ssr: false }),
  check: dynamic(() => import("./check"), { ssr: false }),
  legal: dynamic(() => import("./legal"), { ssr: false }),
  laptop: dynamic(() => import("./laptop"), { ssr: false }) as ComponentType<{ image?: string }>,
  lost: dynamic(() => import("./lost"), { ssr: false }),
} satisfies Record<string, ComponentType<{ image?: string }>>;

export type HeroSceneKey = keyof typeof heroScenes;
