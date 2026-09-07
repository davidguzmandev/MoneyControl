/**
 * Wise reports card purchases with a merchant category (from the card
 * network's merchant category code), truncated to a fixed length, e.g.
 * "Fast Food Restaurants" or "Limousines" (Uber rides land here). This maps
 * those onto the app's default expense category names so a Wise expense
 * can land directly in the matching category instead of the generic
 * "Wise Gasto" bucket. Transfers and anything unrecognized return null and
 * fall back to "Wise Gasto".
 */
const CATEGORY_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /restaurant|fast food|food store|grocery|supermarket|meat|convenien/i, category: "Comida" },
  { pattern: /limousine|taxi|automotive|airline|parking|car wash|fuel|gas station|transport/i, category: "Transporte" },
  { pattern: /drug store|pharmac|health practitioner|medical|dental|hospital/i, category: "Salud" },
  { pattern: /clothing|apparel|shoe store|footwear/i, category: "Ropa" },
  { pattern: /florist|jewelry|precious stones/i, category: "Regalos" },
  { pattern: /club|entertainment|recreation|beauty|barber|movie|theatre|cinema/i, category: "Ocio" },
  { pattern: /real estate|rent|housing/i, category: "Renta" },
];

// Some merchants get filed by Wise under a generic MCC bucket (e.g. a
// specific Uber sub-merchant landing under "Business Services not
// elsewhere" instead of "Limousines"). When the category itself doesn't
// match, the merchant/description name is checked as a second signal.
const MERCHANT_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /uber|lyft|didi|cabify|taxi/i, category: "Transporte" },
];

export function mapWiseCategory(
  wiseCategory: string | undefined | null,
  merchantName?: string | null
): string | null {
  if (wiseCategory) {
    const match = CATEGORY_RULES.find((rule) => rule.pattern.test(wiseCategory));
    if (match) return match.category;
  }
  if (merchantName) {
    const match = MERCHANT_RULES.find((rule) => rule.pattern.test(merchantName));
    if (match) return match.category;
  }
  return null;
}
