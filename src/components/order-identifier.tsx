export function shortOrderId(id: string | null | undefined): string {
  if (!id) return "PED-------";
  const clean = id.replace(/-/g, "").toUpperCase();
  return `PED-${clean.slice(0, 6)}`;
}

export function formatAppOrderNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "APP-0000";
  return `APP-${String(num).padStart(4, "0")}`;
}

export function OrderIdentifier({ 
  id, 
  appOrderNumber, 
  className 
}: { 
  id?: string; 
  appOrderNumber?: number | null; 
  className?: string 
}) {
  // Sprint 8.9.41: Prioritize appOrderNumber
  if (appOrderNumber !== undefined && appOrderNumber !== null) {
    return (
      <span className={"font-mono text-xs tracking-tight text-muted-foreground " + (className ?? "")}>
        {formatAppOrderNumber(appOrderNumber)}
      </span>
    );
  }

  // Fallback to short UUID for backward compatibility during transition or if missing
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