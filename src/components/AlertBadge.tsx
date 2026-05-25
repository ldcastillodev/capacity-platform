import type { AlertLevel } from "@/lib/client";

const cfg: Record<AlertLevel, { label: string; bg: string; color: string }> = {
  safe:     { label: "On Track",  bg: "var(--safe-bg)",     color: "var(--safe)" },
  watch:    { label: "Watch",     bg: "var(--watch-bg)",    color: "var(--watch)" },
  warning:  { label: "Warning",   bg: "var(--warning-bg)",  color: "var(--warning)" },
  critical: { label: "Critical",  bg: "var(--critical-bg)", color: "var(--critical)" },
};

export default function AlertBadge({ level }: { level: AlertLevel }) {
  const { label, bg, color } = cfg[level] ?? cfg.safe;
  return (
    <span
      style={{
        background: bg,
        color,
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
