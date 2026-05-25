import type { SVGProps } from "react";

export function VisLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 56 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <text
        x="0"
        y="12"
        fill="currentColor"
        style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em" }}
        fontFamily="Inter, system-ui, sans-serif"
      >
        VISA
      </text>
    </svg>
  );
}
