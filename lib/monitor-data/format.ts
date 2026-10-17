export function fmtP(v: number | null | undefined, d = 1): string {
  return v == null ? "—" : (v * 100).toFixed(d) + "%";
}

export function fmtN(v: number | null | undefined): string {
  return v == null ? "—" : Math.round(v).toLocaleString("es-MX");
}

export function fmt$(v: number | null | undefined): string {
  return v == null ? "—" : "$" + v.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}
