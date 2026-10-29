import type { EffectiveStatus } from "@/server/content/posts";

export const POST_STATUS: Record<EffectiveStatus, { label: string; pill: string }> = {
  live: { label: "Veröffentlicht", pill: "ok" },
  scheduled: { label: "Geplant", pill: "info" },
  draft: { label: "Entwurf", pill: "muted" },
};

export function PostStatusPill({ status }: { status: EffectiveStatus }) {
  const s = POST_STATUS[status];
  return <span className={`a-pill a-pill--${s.pill}`}>{s.label}</span>;
}
