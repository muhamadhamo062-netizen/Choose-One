import type { SVGProps } from "react";

export function ApplePayMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <text
        x="0"
        y="11"
        fill="currentColor"
        style={{ fontSize: "7px" }}
        fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
      >
        Apple Pay
      </text>
    </svg>
  );
}
