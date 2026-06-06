"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function ManagementModal({ isOpen, onClose, title, children }: ManagementModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
