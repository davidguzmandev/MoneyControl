const WISE_API_BASE = "https://api.wise.com";

export class WiseApiError extends Error {}

async function wiseRequest<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${WISE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WiseApiError(`Wise API ${path} respondió ${res.status}: ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

export interface WiseProfile {
  id: number;
  type: "PERSONAL" | "BUSINESS";
}

export interface WiseBalance {
  id: number;
  currency: string;
  type: string;
  amount: { value: number; currency: string };
}

export interface WiseStatementTransaction {
  type: "CREDIT" | "DEBIT";
  date: string;
  amount: { value: number; currency: string };
  details: { description?: string; paymentReference?: string; type?: string };
  referenceNumber: string;
}

export interface WiseStatement {
  transactions: WiseStatementTransaction[];
}

export async function getProfiles(token: string): Promise<WiseProfile[]> {
  return wiseRequest<WiseProfile[]>(token, "/v1/profiles");
}

export async function getBalances(token: string, profileId: number): Promise<WiseBalance[]> {
  return wiseRequest<WiseBalance[]>(token, `/v4/profiles/${profileId}/balances?types=STANDARD`);
}

export async function getStatement(
  token: string,
  profileId: number,
  balanceId: number,
  currency: string,
  intervalStart: Date,
  intervalEnd: Date
): Promise<WiseStatement> {
  const params = new URLSearchParams({
    currency,
    intervalStart: intervalStart.toISOString(),
    intervalEnd: intervalEnd.toISOString(),
    type: "COMPACT",
  });
  return wiseRequest<WiseStatement>(
    token,
    `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json?${params.toString()}`
  );
}
