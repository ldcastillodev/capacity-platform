import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  submitLabel = "Save",
  onCancel,
  isSubmitting = false,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {onSubmit && (
          <SheetFooter className="px-6 py-4 border-t gap-2">
            <Button variant="outline" onClick={onCancel ?? (() => onOpenChange(false))}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
