import { useEffect, useState } from "react";
import type { BudgetSummary, Currency } from "../types";
import { formatMoney } from "../lib/format";
import { useLanguage } from "../context/LanguageContext";
import { todayISODate } from "../lib/format";

const STORAGE_KEY = "moneycontrol_dismissed_alerts";

interface DismissedMap {
  [alertId: string]: string; // date it was dismissed on (YYYY-MM-DD)
}

function readDismissed(): DismissedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DismissedMap) : {};
  } catch {
    return {};
  }
}

function writeDismissed(map: DismissedMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable, dismissal just won't persist across reloads
  }
}

interface Alert {
  id: string;
  message: string;
}

export function BudgetAlerts({
  budget,
  lowBalanceAlert,
  currency,
}: {
  budget: BudgetSummary | undefined;
  lowBalanceAlert: number | null | undefined;
  currency: Currency;
}) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState<DismissedMap>({});

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (!budget) return null;

  const alerts: Alert[] = [];

  if (lowBalanceAlert != null && budget.remainingMonthly < lowBalanceAlert) {
    alerts.push({
      id: "lowBalance",
      message: t("alerts.lowBalance", {
        remaining: formatMoney(budget.remainingMonthly, currency),
        limit: formatMoney(lowBalanceAlert, currency),
      }),
    });
  }

  if (budget.remainingToday < 0) {
    alerts.push({
      id: "dailyOverBudget",
      message: t("alerts.dailyOverBudget", {
        amount: formatMoney(Math.abs(budget.remainingToday), currency),
      }),
    });
  }

  if (budget.monthlyBudget > 0 && budget.spentSoFar > budget.monthlyBudget) {
    alerts.push({
      id: "periodOverBudget",
      message: t("alerts.periodOverBudget", {
        budget: formatMoney(budget.monthlyBudget, currency),
        amount: formatMoney(budget.spentSoFar - budget.monthlyBudget, currency),
      }),
    });
  }

  const today = todayISODate();
  const visibleAlerts = alerts.filter((a) => dismissed[a.id] !== today);

  if (visibleAlerts.length === 0) return null;

  function dismiss(id: string) {
    const next = { ...readDismissed(), [id]: today };
    writeDismissed(next);
    setDismissed(next);
  }

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          <span>{alert.message}</span>
          <button
            onClick={() => dismiss(alert.id)}
            aria-label={t("common.closeAlert")}
            className="shrink-0 text-amber-600 transition hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
