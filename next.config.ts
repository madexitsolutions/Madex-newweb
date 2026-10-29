import type { NextConfig } from "next";

/** Old WordPress URLs that changed or were removed – permanent redirects keep links and rankings. */
const legacyRedirects: { source: string; destination: string }[] = [
  // posts whose slugs contained a non-breaking hyphen (U+2011) – raw and percent-encoded forms
  {
    source: "/mehoma-professionelle-dienstleistungen-und-kundenorientierter-online%E2%80%91auftritt-entwickelt-von-madex-it-solutions",
    destination: "/mehoma-professionelle-dienstleistungen-und-kundenorientierter-online-auftritt-entwickelt-von-madex-it-solutions",
  },
  {
    source: "/mila-dopiz-stilvoller-online%E2%80%91auftritt-fur-hochwertige-mode-entwickelt-von-madex-it-solutions",
    destination: "/mila-dopiz-stilvoller-online-auftritt-fur-hochwertige-mode-entwickelt-von-madex-it-solutions",
  },
  // copy/paste slugs from the old site, now named after the real projects
  { source: "/neues-branding-und-moderne-website-fur-klimas-innenausbau-copy-copy", destination: "/garage-t-schneider-neuer-digitaler-auftritt" },
  { source: "/neues-branding-und-moderne-website-fur-klimas-innenausbau-copy", destination: "/natura-balance-schweiz-moderne-webpraesenz-fur-naturliche-kosmetik" },
  // archives
  // the blog was retired – its two articles map to the matching services
  { source: "/blog", destination: "/" },
  { source: "/category/blog", destination: "/" },
  { source: "/warum-webdesign-so-wichtig-ist-und-warum-ihr-unternehmen-eine-website-braucht", destination: "/marketing-solutions/website-development" },
  { source: "/grafikdesign-und-die-wirkung-von-social-media-posts", destination: "/marketing-solutions/graphic-design" },
  { source: "/category/website-portfolio", destination: "/website-portfolio" },
  { source: "/tag/website", destination: "/website-portfolio" },
  { source: "/tag/:tag", destination: "/website-portfolio" },
  // internal WordPress page, not part of the public site
  { source: "/mi-dashboard", destination: "/" },
  // German-friendly aliases
  { source: "/leistungen", destination: "/marketing-solutions" },
  { source: "/ueber-uns", destination: "/uber-uns" },
  { source: "/team", destination: "/das-team" },
  { source: "/partner", destination: "/partners" },
  { source: "/projekte", destination: "/website-portfolio" },
  { source: "/kostenlose-pruefung", destination: "/kostenlose-prufung" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  poweredByHeader: false,
  // dashboard (src/server, /madexadm): native/wasm database drivers stay outside the bundle
  // PDF report (website analysis): renders with its own layout engine on the server
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "@react-pdf/renderer"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    // Shared hosts (Hostinger) report many CPUs but limit processes/threads per account:
    // with the default, `next build` starts one worker per CPU and crashes ("can't spawn worker thread").
    cpus: Number(process.env.NEXT_BUILD_CPUS) || 2,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [480, 640, 828, 1080, 1280, 1600, 1920],
    // YouTube preview thumbnails (werbevideos-portfolio) – proxied by the optimiser, so visitors don't contact Google before clicking play
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**", search: "" }],
  },
  async redirects() {
    return legacyRedirects.flatMap((r) => [
      { ...r, permanent: true },
      { source: `${r.source}/`, destination: r.destination, permanent: true },
    ]);
  },
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/madexadm/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
