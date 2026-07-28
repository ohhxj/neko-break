import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "accent" | "secondary" | "warning" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconOnly?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconOnly = false,
  className = "",
  children,
  ...props
}: Props) {
  const compatibilityClass = variant === "secondary" || variant === "ghost" ? "secondary" : "";
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    iconOnly ? "ui-button--icon-only" : "",
    compatibilityClass,
    className
  ].filter(Boolean).join(" ");

  return (
    <button className={classes} {...props}>
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      {iconOnly ? null : <span className="ui-button__label">{children}</span>}
    </button>
  );
}
