"use client";

import React from "react";

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
  isPending,
}: ArchiveConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={onCancel}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 28,
          width: 420,
          maxWidth: "90vw",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
          Archive &ldquo;{entityName}&rdquo;?
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          This record will be hidden from active views. Related records will be closed. The change is logged and can be reviewed by an admin.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              fontSize: 14,
              cursor: "pointer",
              color: "var(--text)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              border: "none",
              background: "var(--critical)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "Archiving…" : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
