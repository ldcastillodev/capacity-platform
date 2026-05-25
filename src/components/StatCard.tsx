interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export function StatCard({ label, value, sub, color }: Props) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: color ?? "var(--text)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{sub}</div>
      )}
    </div>
  );
}

export default StatCard;
