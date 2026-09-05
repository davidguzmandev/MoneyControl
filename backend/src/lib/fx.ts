export class FxError extends Error {}

/**
 * General-purpose exchange rate lookup, independent of Wise, so currency
 * conversion works even for users who never connect a Wise account. Uses
 * a free, keyless rate API (no auth required).
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
  if (!res.ok) {
    throw new FxError(`No se pudo obtener la tasa de cambio de ${from} a ${to}`);
  }
  const data = (await res.json()) as { result: string; rates?: Record<string, number> };
  const rate = data.rates?.[to];
  if (data.result !== "success" || !rate) {
    throw new FxError(`No se encontró tasa de cambio de ${from} a ${to}`);
  }
  return rate;
}
