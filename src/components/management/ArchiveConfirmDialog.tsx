"use client";

import { ConfirmDialog } from "@/components/app/ConfirmDialog";

interface ArchiveConfirmDialogProps {
  isOpen: boolean;
  entityName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function ArchiveConfirmDialog({
  isOpen,
  entityName,
  onConfirm,
  onCancel,
  isPending: _isPending,
}: ArchiveConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(v) => { if (!v) onCancel(); }}
      title={`Archive "${entityName}"?`}
      description="This record will be hidden from active views. Related records will be closed. The change is logged and can be reviewed by an admin."
      confirmLabel="Archive"
      destructive
      onConfirm={onConfirm}
    />
  );
}
