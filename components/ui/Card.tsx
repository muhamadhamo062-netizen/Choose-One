import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return <div className={cn("glass rounded-2xl p-6 shadow-2xl", className)}>{children}</div>;
}
