import type { Block } from "@/content/posts";
import "@/app/prose.css";

/** Renders legal text blocks; numbered section titles ("3. Zahlung…") become headings. */
export function LegalBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="legal prose legal-body">
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
        .legal-body{--measure:68ch}
        .legal-body>h2{padding-top:1.1em;border-top:1px solid var(--line)}
        .legal-body>h2:first-child{padding-top:0;border-top:0}
        .legal-body>* + h2{margin-top:2em}
        .legal-body p{overflow-wrap:break-word;hyphens:auto}
      `}</style>
    </div>
  );
}
