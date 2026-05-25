import { cn } from "@/lib/utils";

interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

export function Badge({ className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium text-indigo-200",
        className
      )}
    >
      {children}
    </span>
  );
}
