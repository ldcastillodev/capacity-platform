import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
}

export function FilterSheet({
  open,
  onOpenChange,
  title = "Filters",
  children,
  onApply,
  onReset,
}: FilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:max-w-[340px] flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <SheetFooter className="px-6 py-4 border-t gap-2">
          {onReset && (
            <Button variant="ghost" onClick={onReset}>
              Reset
            </Button>
          )}
          {onApply && (
            <Button onClick={onApply}>Apply</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
