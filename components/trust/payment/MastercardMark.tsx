import type { SVGProps } from "react";

export function MastercardMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <circle cx="16" cy="12" r="8" fill="#EB001B" opacity="0.92" />
      <circle cx="24" cy="12" r="8" fill="#F79E1B" opacity="0.92" />
    </svg>
  );
}
