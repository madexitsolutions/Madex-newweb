import { MARK_HEX, MARK_PATHS, MARK_SIZE } from "@/lib/mark";

type Props = { className?: string; title?: string; animated?: boolean };

/** Inline SVG of the Madex mark (decorative unless a title is given). */
export function MarkSvg({ className, title, animated }: Props) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${MARK_SIZE.w} ${MARK_SIZE.h}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {MARK_PATHS.map((s, i) => (
        <path key={i} d={s.d} fill={MARK_HEX[s.color]} className={animated ? `mark-piece mark-piece--${i}` : undefined} />
      ))}
    </svg>
  );
}
