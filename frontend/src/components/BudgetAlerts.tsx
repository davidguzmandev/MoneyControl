import type { BudgetSummary, Currency } from "../types";
import { formatMoney } from "../lib/format";

export function BudgetAlerts({
  budget,
  lowBalanceAlert,
  currency,
}: {
  budget: BudgetSummary | undefined;
  lowBalanceAlert: number | null | undefined;
  currency: Currency;
}) {
  if (!budget) return null;

  const alerts: string[] = [];

  if (lowBalanceAlert != null && budget.remainingMonthly < lowBalanceAlert) {
    alerts.push(
      `Tu restante del mes (${formatMoney(budget.remainingMonthly, currency)}) ya bajó de tu límite de aviso (${formatMoney(
        lowBalanceAlert,
        currency
      )}). Te estás quedando sin dinero disponible este periodo.`
    );
  }

  if (budget.remainingToday < 0) {
    alerts.push(
      `Ya superaste lo que puedes gastar hoy por ${formatMoney(Math.abs(budget.remainingToday), currency)}.`
    );
  }

  if (budget.monthlyBudget > 0 && budget.spentSoFar > budget.monthlyBudget) {
    alerts.push(
      `Superaste tu presupuesto del periodo (${formatMoney(budget.monthlyBudget, currency)}) por ${formatMoney(
        budget.spentSoFar - budget.monthlyBudget,
        currency
      )}.`
    );
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((message, i) => (
        <div
          key={i}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          {message}
        </div>
      ))}
    </div>
  );
}
