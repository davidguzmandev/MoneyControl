import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { BudgetSummary, Category, Currency, Transaction } from "../types";
import { formatDate, formatMoney, todayISODate } from "../lib/format";
import { Button, Card, Input, Label } from "../components/ui";
import { Modal } from "../components/Modal";
import { BudgetAlerts } from "../components/BudgetAlerts";
import { TransactionForm } from "../components/TransactionForm";
import type { TransactionFormValues } from "../components/TransactionForm";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export function DashboardPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const currency = user?.currency ?? "USD";
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data: budget } = useQuery({
    queryKey: ["budget", "summary"],
    queryFn: () => api.get<BudgetSummary>(`/budget/summary?date=${todayISODate()}`),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories").then((r) => r.categories),
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => api.get<{ transactions: Transaction[] }>("/transactions?limit=6").then((r) => r.transactions),
  });

  const createMutation = useMutation({
    mutationFn: (values: TransactionFormValues) => api.post("/transactions", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      setModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: TransactionFormValues) => api.patch(`/transactions/${editing!.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
    },
  });

  const todayAllowance = budget?.todayAllowance ?? 0;
  const spentToday = budget?.spentToday ?? 0;
  const remainingToday = budget?.remainingToday ?? 0;
  const progressPct = todayAllowance > 0 ? Math.min(100, (spentToday / todayAllowance) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("nav.dashboard")}</h1>
          {budget && (
            <p className="text-sm text-slate-500">
              {t("dashboard.periodLabel", {
                start: formatDate(budget.periodStart, language),
                end: formatDate(budget.periodEnd, language),
              })}
            </p>
          )}
        </div>
        <Button onClick={() => setModalOpen(true)}>{t("dashboard.newTransaction")}</Button>
      </div>

      <BudgetAlerts budget={budget} lowBalanceAlert={user?.lowBalanceAlert} currency={currency} />

      <Card className="text-center">
        <p className="text-sm text-slate-500">{t("dashboard.canSpendToday")}</p>
        <p className="my-2 text-4xl font-semibold tracking-tight">
          {formatMoney(Math.max(remainingToday, 0), currency)}
        </p>
        <div className="mx-auto h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-900 dark:bg-slate-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {t("dashboard.spentTodayOf", {
            spent: formatMoney(spentToday, currency),
            allowance: formatMoney(Math.max(todayAllowance, 0), currency),
          })}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">{t("dashboard.monthlyBudget")}</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(budget?.monthlyBudget ?? 0, currency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t("dashboard.spentInPeriod")}</p>
          <p className="mt-1 text-lg font-semibold text-expense">
            {formatMoney(budget?.spentSoFar ?? 0, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t("dashboard.remainingMonth")}</p>
          <p
            className={`mt-1 text-lg font-semibold ${
              (budget?.remainingMonthly ?? 0) < 0 ? "text-expense" : "text-income"
            }`}
          >
            {formatMoney(budget?.remainingMonthly ?? 0, currency)}
          </p>
        </Card>
      </div>

      <SavingsSection savingsGoal={budget?.savingsGoal ?? 0} currency={currency} />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">{t("dashboard.recentTransactions")}</h2>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {transactions?.map((t2) => (
            <li key={t2.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t2.category.color }} />
                <div>
                  <p className="text-sm font-medium">{t2.category.name}</p>
                  <p className="text-xs text-slate-400">{formatDate(t2.date.slice(0, 10), language)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${t2.type === "INCOME" ? "text-income" : "text-expense"}`}>
                  {t2.type === "INCOME" ? "+" : "-"}
                  {formatMoney(t2.amount, currency)}
                </span>
                <button
                  onClick={() => setEditing(t2)}
                  className="text-xs text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(t2.id)}
                  className="text-xs text-slate-400 transition hover:text-red-600"
                >
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
          {transactions?.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-400">{t("dashboard.noTransactionsYet")}</li>
          )}
        </ul>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("transactionForm.newTitle")}>
        <TransactionForm
          categories={categories ?? []}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("transactionForm.editTitle")}>
        {editing && (
          <TransactionForm
            categories={categories ?? []}
            initial={editing}
            submitLabel={t("common.saveChanges")}
            onSubmit={async (values) => {
              await updateMutation.mutateAsync(values);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function SavingsSection({ savingsGoal, currency }: { savingsGoal: number; currency: Currency }) {
  const { updateSettings } = useAuth();
  const { t } = useLanguage();
  const [value, setValue] = useState(String(savingsGoal));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(savingsGoal ?? 0));
  }, [savingsGoal]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const parsed = trimmed === "" ? 0 : Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError(t("validation.invalidAmount"));
      return;
    }
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await updateSettings({ savingsGoal: parsed });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("savings.saveError"));
      setValue(String(savingsGoal));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("savings.title")}</h2>
          <p className="text-xs text-slate-400">{t("savings.description")}</p>
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="w-32">
            <Label htmlFor="savingsGoal">{t("savings.goalLabel")}</Label>
            <Input
              id="savingsGoal"
              type="number"
              min={0}
              step="0.01"
              value={value}
              disabled={saving}
              onChange={(e) => {
                setValue(e.target.value);
                setSuccess(false);
              }}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </form>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {success && (
        <p className="mt-2 text-xs text-emerald-600">
          {t("savings.savedMessage", { amount: formatMoney(Number(value) || 0, currency) })}
        </p>
      )}
    </Card>
  );
}
