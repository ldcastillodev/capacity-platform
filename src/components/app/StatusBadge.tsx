import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        safe: "bg-[var(--safe-bg)] text-[var(--safe)]",
        watch: "bg-[var(--watch-bg)] text-[var(--watch)]",
        warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
        critical: "bg-[var(--critical-bg)] text-[var(--critical)]",
        default: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { tone: "default" },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  label: string;
  className?: string;
}

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      {label}
    </span>
  );
}
