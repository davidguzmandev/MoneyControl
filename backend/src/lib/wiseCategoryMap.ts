/**
 * Wise reports card purchases with a merchant category (from the card
 * network's merchant category code), truncated to a fixed length, e.g.
 * "Fast Food Restaurants" or "Limousines" (Uber rides land here). This maps
 * those onto the app's default expense category names so a Wise expense
 * can land directly in the matching category instead of the generic
 * "Wise Gasto" bucket. Transfers and anything unrecognized return null and
 * fall back to "Wise Gasto".
 */
const RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /restaurant|fast food|food store|grocery|supermarket|meat|convenien/i, category: "Comida" },
  { pattern: /limousine|taxi|automotive|airline|parking|car wash|fuel|gas station|transport/i, category: "Transporte" },
  { pattern: /drug store|pharmac|health practitioner|medical|dental|hospital/i, category: "Salud" },
  { pattern: /clothing|apparel|shoe store|footwear/i, category: "Ropa" },
  { pattern: /florist|jewelry|precious stones/i, category: "Regalos" },
  { pattern: /club|entertainment|recreation|beauty|barber|movie|theatre|cinema/i, category: "Ocio" },
  { pattern: /real estate|rent|housing/i, category: "Renta" },
];

export function mapWiseCategory(wiseCategory: string | undefined | null): string | null {
  if (!wiseCategory) return null;
  const match = RULES.find((rule) => rule.pattern.test(wiseCategory));
  return match?.category ?? null;
}
