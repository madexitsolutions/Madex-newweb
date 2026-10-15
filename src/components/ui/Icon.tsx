import type { IconName } from "@/content/services";

type Name = IconName | "arrow" | "arrow-up-right" | "plus" | "phone" | "mail" | "pin" | "play" | "close" | "menu" | "check" | "chat" | "star" | "spark";

const P: Record<Name, string> = {
  web: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 4h18M7 7h.01M10 7h.01M9.5 13l-2 2 2 2m5-4 2 2-2 2",
  digital: "M3 17l5-5 4 4 8-8m0 0h-5m5 0v5",
  seo: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2M8 11h6m-3-3v6",
  video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm12 4 5-3v10l-5-3",
  social: "M17 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9.6 13.5l4.8 2.9m0-8.8-4.8 2.9",
  google: "M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5ZM12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21ZM7 13.8a5.4 5.4 0 0 1 0-3.5V8H4a9 9 0 0 0 0 8.1l3-2.3ZM12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7Z",
  design: "M12 3a9 9 0 0 0 0 18c1 0 1.5-.6 1.5-1.4 0-.4-.2-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8.2-9-8.2ZM7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  analysis: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  ai: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  "arrow-up-right": "M7 17 17 7m-9 0h9v9",
  plus: "M12 5v14M5 12h14",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  play: "M8 5v14l11-7z",
  close: "M6 6l12 12M18 6 6 18",
  menu: "M4 8h16M4 16h16",
  check: "M5 12.5l4.5 4.5L19 7",
  chat: "M4 5h16v11H8l-4 4V5Z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  spark: "M12 2v6m0 8v6M2 12h6m8 0h6M5 5l4 4m6 6 4 4M5 19l4-4m6-6 4-4",
};

export function Icon({ name, size = 24, className, strokeWidth = 1.6 }: { name: Name; size?: number; className?: string; strokeWidth?: number }) {
  const filled = name === "play" || name === "star";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={P[name]} />
    </svg>
  );
}
