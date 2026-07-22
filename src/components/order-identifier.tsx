export function shortOrderId(id: string | null | undefined): string {
  if (!id) return "PED-------";
  const clean = id.replace(/-/g, "").toUpperCase();
  return `PED-${clean.slice(0, 6)}`;
}

export function OrderIdentifier({ id, className }: { id: string; className?: string }) {
  return (
    <span className={"font-mono text-xs tracking-tight text-muted-foreground " + (className ?? "")}>
      {shortOrderId(id)}
    </span>
  );
}

export function companyLabel(companyId: number | null | undefined): string {
  if (companyId === 1) return "Graal";
  if (companyId === 3) return "Grott";
  return "—";
}