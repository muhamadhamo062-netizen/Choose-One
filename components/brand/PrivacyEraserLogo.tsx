import { cn } from "@/lib/utils";

type PrivacyEraserLogoProps = {
  /** Icon only, or icon + wordmark */
  variant?: "mark" | "full";
  /** Mark box size in px (height = width) */
  markSize?: number;
  className?: string;
  /** Hide wordmark on very narrow screens when variant=full */
  compactWordmark?: boolean;
};

/** Brand mark: shield + identity erasure sweep + active protection pulse */
export function PrivacyEraserLogo({
  variant = "full",
  markSize = 32,
  className,
  compactWordmark = false
}: PrivacyEraserLogoProps) {
  const mark = (
    <svg
      width={markSize}
      height={markSize}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id="pe-shield" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A5B4FC" />
          <stop offset="0.45" stopColor="#6366F1" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="pe-sweep" x1="10" y1="30" x2="38" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22C55E" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="#34D399" />
          <stop offset="1" stopColor="#6EE7B7" stopOpacity="0.9" />
        </linearGradient>
        <filter id="pe-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="48" height="48" rx="13" fill="#0B0F19" />
      <rect
        x="0.75"
        y="0.75"
        width="46.5"
        height="46.5"
        rx="12.25"
        stroke="url(#pe-shield)"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path
        d="M24 7.5 37.5 13.2V24.2c0 7.2-6.2 13.4-13.5 16.3C16.7 37.6 10.5 31.4 10.5 24.2V13.2L24 7.5Z"
        fill="url(#pe-shield)"
      />
      <path
        d="M24 11.2 33.8 15.4v8.4c0 5.2-4.4 9.8-9.8 11.8-5.4-2-9.8-6.6-9.8-11.8v-8.4L24 11.2Z"
        fill="#0B0F19"
        fillOpacity="0.88"
      />
      <path
        d="M13.5 29.5c4.2-3.8 8.8-6.2 10.5-7 5.2-2.6 9.8-4.2 14.2-6.2"
        stroke="url(#pe-sweep)"
        strokeWidth="2.75"
        strokeLinecap="round"
        filter="url(#pe-glow)"
      />
      <circle cx="24" cy="26.5" r="5.5" fill="#22C55E" fillOpacity="0.18" />
      <circle cx="24" cy="26.5" r="2.6" fill="#34D399" />
      <path
        d="M22.6 26.6 23.6 27.6 25.6 25.4"
        stroke="#0B0F19"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "mark") {
    return <span className={cn("inline-flex", className)}>{mark}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark}
      <span
        className={cn(
          "font-bold tracking-tight text-white",
          compactWordmark && "hidden min-[380px]:inline"
        )}
      >
        PrivacyEraser
        <span className="font-semibold text-indigo-300">.ai</span>
      </span>
    </span>
  );
}
