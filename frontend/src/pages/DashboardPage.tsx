import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { BudgetSummary, Category, CategoryStat, Currency, Transaction } from "../types";
import { formatDate, formatMoney, todayISODate } from "../lib/format";
import { Button, Card, Input, Label } from "../components/ui";
import { Modal } from "../components/Modal";
import { BudgetAlerts } from "../components/BudgetAlerts";
import { Sparkline } from "../components/Sparkline";
import { CategoryPieCard } from "../components/CategoryPieCard";
import { CurrencyConvertModal } from "../components/CurrencyConvertModal";
import { TransactionForm } from "../components/TransactionForm";
import type { TransactionFormValues } from "../components/TransactionForm";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

export function DashboardPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const currency = user?.currency ?? "USD";
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [budgetDetailOpen, setBudgetDetailOpen] = useState(false);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState(false);

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

  const periodParams = new URLSearchParams();
  if (budget) {
    periodParams.set("from", budget.periodStart);
    periodParams.set("to", budget.periodEnd);
  }

  const { data: timeline } = useQuery({
    queryKey: ["stats", "timeline", "dashboard", budget?.periodStart, budget?.periodEnd],
    queryFn: () =>
      api
        .get<{ timeline: { date: string; income: number; expense: number }[] }>(
          `/stats/timeline?${periodParams.toString()}`
        )
        .then((r) => r.timeline),
    enabled: !!budget,
  });

  const expenseParams = new URLSearchParams(periodParams);
  expenseParams.set("type", "EXPENSE");
  const { data: expenseByCategory } = useQuery({
    queryKey: ["stats", "by-category", "EXPENSE", "dashboard", budget?.periodStart, budget?.periodEnd],
    queryFn: () =>
      api
        .get<{ categories: CategoryStat[] }>(`/stats/by-category?${expenseParams.toString()}`)
        .then((r) => r.categories),
    enabled: !!budget,
  });

  const createMutation = useMutation({
    mutationFn: (values: TransactionFormValues) => api.post("/transactions", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: TransactionFormValues) => api.patch(`/transactions/${editing!.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const todayAllowance = budget?.todayAllowance ?? 0;
  const spentToday = budget?.spentToday ?? 0;
  const remainingToday = budget?.remainingToday ?? 0;
  const remainingMonthly = budget?.remainingMonthly ?? 0;
  const monthlyBudget = budget?.monthlyBudget ?? 0;
  const spentSoFar = budget?.spentSoFar ?? 0;
  const todayProgressPct = todayAllowance > 0 ? Math.min(100, (spentToday / todayAllowance) * 100) : 0;
  const budgetProgressPct = monthlyBudget > 0 ? Math.min(100, (spentSoFar / monthlyBudget) * 100) : 0;
  const budgetOverBudget = monthlyBudget > 0 && spentSoFar > monthlyBudget;
  const daysLeft = budget ? Math.max(0, daysBetween(todayISODate(), budget.periodEnd)) : 0;

  return (
    <div className="space-y-6">
      <BudgetAlerts budget={budget} lowBalanceAlert={user?.lowBalanceAlert} currency={currency} />

      {/* Hero balance card */}
      <div className="rounded-3xl bg-slate-900 p-6 text-white dark:bg-black">
        <p className="text-sm text-slate-400">{t("dashboard.remainingMonth")}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{formatMoney(remainingMonthly, currency)}</p>
        <p className="mt-2 text-xs text-slate-400">
          {t("dashboard.incomeExpenseSummary", {
            income: formatMoney(budget?.incomeSoFar ?? 0, currency),
            expense: formatMoney(spentSoFar, currency),
          })}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setConvertOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <ArrowLeftRight size={16} />
            {t("dashboard.convertCurrency")}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            <Plus size={16} />
            {t("dashboard.addAction")}
          </button>
        </div>
      </div>

      {/* Today progress card */}
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{t("dashboard.canSpendToday")}</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {Math.round(todayProgressPct)}%
          </span>
        </div>
        <p className="my-2 text-3xl font-semibold tracking-tight">
          {formatMoney(Math.max(remainingToday, 0), currency)}
        </p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
            style={{ width: `${todayProgressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {t("dashboard.spentTodayOf", {
            spent: formatMoney(spentToday, currency),
            allowance: formatMoney(Math.max(todayAllowance, 0), currency),
          })}
          {budget && (
            <>
              {" · "}
              {t("dashboard.daysLeft", { days: daysLeft })} · {t("dashboard.periodEndsOn", { date: formatDate(budget.periodEnd, language) })}
            </>
          )}
        </p>
      </Card>

      {/* Stat cards with mini charts, tappable for detail */}
      <div className="grid grid-cols-2 gap-4">
        <button className="text-left" onClick={() => setBudgetDetailOpen(true)}>
          <Card>
            <p className="text-xs text-slate-500">{t("dashboard.monthlyBudget")}</p>
            <p className="mt-1 text-lg font-semibold">{formatMoney(monthlyBudget, currency)}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${budgetOverBudget ? "bg-red-600" : "bg-slate-900 dark:bg-slate-100"}`}
                style={{ width: `${budgetProgressPct}%` }}
              />
            </div>
          </Card>
        </button>
        <button className="text-left" onClick={() => setExpenseDetailOpen(true)}>
          <Card>
            <p className="text-xs text-slate-500">{t("dashboard.spentInPeriod")}</p>
            <p className="mt-1 text-lg font-semibold text-expense">{formatMoney(spentSoFar, currency)}</p>
            <div className="mt-1">
              <Sparkline data={timeline ?? []} dataKey="expense" color="#dc2626" height={32} />
            </div>
          </Card>
        </button>
      </div>

      <SavingsSection savingsGoal={budget?.savingsGoal ?? 0} currency={currency} />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">{t("dashboard.recentTransactions")}</h2>
        <div className="space-y-2">
          {transactions?.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: tx.category.color }}
                >
                  {tx.category.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tx.category.name}</p>
                  <p className="text-xs text-slate-400">{formatDate(tx.date.slice(0, 10), language)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-income" : "text-expense"}`}>
                  {tx.type === "INCOME" ? "+" : "-"}
                  {formatMoney(tx.amount, currency)}
                </span>
                <button
                  onClick={() => setEditing(tx)}
                  aria-label={t("common.edit")}
                  className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(tx.id)}
                  aria-label={t("common.delete")}
                  className="rounded-full p-1.5 text-slate-400 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {transactions?.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">{t("dashboard.noTransactionsYet")}</p>
          )}
        </div>
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

      <Modal open={convertOpen} onClose={() => setConvertOpen(false)} title={t("dashboard.convertCurrency")}>
        <CurrencyConvertModal onClose={() => setConvertOpen(false)} />
      </Modal>

      <Modal open={budgetDetailOpen} onClose={() => setBudgetDetailOpen(false)} title={t("dashboard.budgetDetailTitle")}>
        <BudgetDetailList categories={categories} spentByCategory={expenseByCategory} currency={currency} />
      </Modal>

      <Modal open={expenseDetailOpen} onClose={() => setExpenseDetailOpen(false)} title={t("dashboard.expenseDetailTitle")}>
        <CategoryPieCard data={expenseByCategory} emptyLabel={t("stats.noExpenseInRange")} currency={currency} />
      </Modal>
    </div>
  );
}

function BudgetDetailList({
  categories,
  spentByCategory,
  currency,
}: {
  categories: Category[] | undefined;
  spentByCategory: CategoryStat[] | undefined;
  currency: Currency;
}) {
  const { t } = useLanguage();
  const spentMap = new Map((spentByCategory ?? []).map((s) => [s.categoryId, s.total]));
  const budgeted = (categories ?? []).filter((c) => c.type === "EXPENSE" && c.monthlyBudget !== null && c.monthlyBudget > 0);

  if (budgeted.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{t("dashboard.noBudgetedCategories")}</p>;
  }

  return (
    <ul className="space-y-4">
      {budgeted.map((c) => {
        const spent = spentMap.get(c.id) ?? 0;
        const pct = Math.min(100, (spent / c.monthlyBudget!) * 100);
        const over = spent > c.monthlyBudget!;
        return (
          <li key={c.id}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
              <span className={over ? "text-expense" : "text-slate-500"}>
                {formatMoney(spent, currency)} / {formatMoney(c.monthlyBudget!, currency)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${over ? "bg-red-600" : "bg-slate-900 dark:bg-slate-100"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
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
