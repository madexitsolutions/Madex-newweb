import type { ReactNode } from "react";
import { Link } from "@/components/layout/Transition";
import { Icon } from "./Icon";
import { Magnetic } from "./motion";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "light" | "ghost";
  size?: "md" | "sm";
  icon?: boolean;
  magnetic?: boolean;
  className?: string;
  target?: string;
};

export function Button({ href, children, variant = "primary", size = "md", icon = true, magnetic = true, className, target }: Props) {
  const cls = ["btn", variant !== "primary" && `btn--${variant}`, size === "sm" && "btn--sm", className].filter(Boolean).join(" ");
  const external = /^https?:/.test(href);
  const inner = (
    <Link href={href} className={cls} target={target} rel={external ? "noopener noreferrer" : undefined}>
      <span>{children}</span>
      {icon && (
        <span className="btn__icon">
          <Icon name="arrow-up-right" size={16} strokeWidth={2} />
        </span>
      )}
    </Link>
  );
  return magnetic ? <Magnetic strength={0.25}>{inner}</Magnetic> : inner;
}
