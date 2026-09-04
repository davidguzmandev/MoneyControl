import type { Currency } from "../types";

const CURRENCY_LOCALE: Record<Currency, string> = {
  USD: "en-US",
  COP: "es-CO",
  MXN: "es-MX",
  CAD: "en-CA",
};

const formatterCache = new Map<Currency, Intl.NumberFormat>();

function getFormatter(currency: Currency): Intl.NumberFormat {
  let formatter = formatterCache.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    });
    formatterCache.set(currency, formatter);
  }
  return formatter;
}

export function formatMoney(amount: number, currency: Currency = "USD"): string {
  return getFormatter(currency).format(amount);
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function todayISODate(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
