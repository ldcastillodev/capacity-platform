import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/app/ThemeToggle";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 mb-6 animate-fade-in sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <ThemeToggle />
        {actions}
      </div>
    </div>
  );
}
