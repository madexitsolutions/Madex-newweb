import type { Block } from "@/content/posts";

/** Renders legal text blocks; numbered section titles ("3. Zahlung…") become headings. */
export function LegalBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="legal">
      {blocks.map((b, i) => {
        if (b.type === "img") return null;
        if (b.type === "h") return <h2 key={i}>{b.text}</h2>;
        if (/^\d+\.\s+\D/.test(b.text) && b.text.length < 80) return <h2 key={i}>{b.text}</h2>;
        return (
          <p key={i}>
            {b.text.split("\n").map((line, k, arr) => (
              <span key={k}>
                {line}
                {k < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
      <style>{`
        .legal{max-width:820px}
        .legal h2{font-size:clamp(22px,2vw,28px);margin:48px 0 16px;padding-top:24px;border-top:1px solid var(--line)}
        .legal p{color:var(--text-soft)}
      `}</style>
    </div>
  );
}
