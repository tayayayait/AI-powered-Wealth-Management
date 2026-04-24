export function formatCurrency(amount: number, currency = "KRW") {
  if (!isFinite(amount)) return "—";
  const fractionDigits = currency === "KRW" ? 0 : 2;
  try {
    return new Intl.NumberFormat(currency === "KRW" ? "ko-KR" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(fractionDigits)} ${currency}`;
  }
}

export function formatNumber(n: number, digits = 2) {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function formatPercent(n: number, digits = 2) {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function pnlColor(n: number) {
  if (n > 0) return "text-pos";
  if (n < 0) return "text-neg";
  return "text-muted-foreground";
}