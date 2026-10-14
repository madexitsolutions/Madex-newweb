import { MARK_SHAPES, MARK_SIZE, markPath } from "@/lib/mark";

type Props = { className?: string; title?: string; animated?: boolean };

/** Inline-SVG of the abstracted double-M mark (decorative unless a title is given). */
export function MarkSvg({ className, title, animated }: Props) {
  return (
    <svg
      className={className}
      viewBox={`-4 -4 ${MARK_SIZE.w + 8} ${MARK_SIZE.h + 8}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {MARK_SHAPES.map((s, i) => (
        <path
          key={i}
          d={markPath(s.points)}
          fill={s.color === "teal" ? "#028D86" : "#025159"}
          stroke={s.color === "teal" ? "#028D86" : "#025159"}
          strokeWidth={8}
          strokeLinejoin="round"
          className={animated ? `mark-piece mark-piece--${i}` : undefined}
        />
      ))}
    </svg>
  );
}
