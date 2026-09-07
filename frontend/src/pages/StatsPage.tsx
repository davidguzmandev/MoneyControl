import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import type { BudgetSummary, Category, CategoryStat, Transaction, TimelinePoint } from "../types";
import { formatDate, formatMoney, todayISODate } from "../lib/format";
import { Button, Card, Select } from "../components/ui";
import { Modal } from "../components/Modal";
import { CategoryPieCard } from "../components/CategoryPieCard";
import { TransactionForm } from "../components/TransactionForm";
import type { TransactionFormValues } from "../components/TransactionForm";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

type RangeOption = "period" | "30" | "90" | "all";

export function StatsPage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const currency = user?.currency ?? "USD";
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeOption>("period");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
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

  const { from, to } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (range === "period" && budget) return { from: budget.periodStart, to: budget.periodEnd };
    if (range === "30" || range === "90") {
      const days = Number(range);
      const d = new Date();
      d.setDate(d.getDate() - days);
      return { from: d.toISOString().slice(0, 10), to: todayStr };
    }
    return { from: undefined, to: undefined };
  }, [range, budget]);

  const rangeParams = new URLSearchParams();
  if (from) rangeParams.set("from", from);
  if (to) rangeParams.set("to", to);

  const expenseParams = new URLSearchParams(rangeParams);
  expenseParams.set("type", "EXPENSE");
  const incomeParams = new URLSearchParams(rangeParams);
  incomeParams.set("type", "INCOME");

  const { data: expenseByCategory } = useQuery({
    queryKey: ["stats", "by-category", "EXPENSE", from, to],
    queryFn: () =>
      api
        .get<{ categories: CategoryStat[] }>(`/stats/by-category?${expenseParams.toString()}`)
        .then((r) => r.categories),
  });

  const { data: incomeByCategory } = useQuery({
    queryKey: ["stats", "by-category", "INCOME", from, to],
    queryFn: () =>
      api
        .get<{ categories: CategoryStat[] }>(`/stats/by-category?${incomeParams.toString()}`)
        .then((r) => r.categories),
  });

  const { data: timeline } = useQuery({
    queryKey: ["stats", "timeline", from, to],
    queryFn: () =>
      api.get<{ timeline: TimelinePoint[] }>(`/stats/timeline?${rangeParams.toString()}`).then((r) => r.timeline),
  });

  const listParams = new URLSearchParams(rangeParams);
  if (categoryFilter) listParams.set("categoryId", categoryFilter);
  if (typeFilter) listParams.set("type", typeFilter);

  const { data: transactions } = useQuery({
    queryKey: ["transactions", "list", from, to, categoryFilter, typeFilter],
    queryFn: () =>
      api.get<{ transactions: Transaction[] }>(`/transactions?${listParams.toString()}`).then((r) => r.transactions),
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

  const filteredTotal = useMemo(() => {
    if (!transactions) return 0;
    return transactions.reduce((sum, t) => sum + (t.type === "INCOME" ? t.amount : -t.amount), 0);
  }, [transactions]);

  const rangeOptions: { key: RangeOption; label: string }[] = [
    { key: "period", label: t("stats.rangePeriod") },
    { key: "30", label: t("stats.range30") },
    { key: "90", label: t("stats.range90") },
    { key: "all", label: t("stats.rangeAll") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("stats.title")}</h1>
          <p className="text-sm text-slate-500">{t("stats.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {rangeOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  range === opt.key
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setModalOpen(true)}>{t("dashboard.newTransaction")}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-500">{t("stats.incomeByCategory")}</h2>
          <CategoryPieCard data={incomeByCategory} emptyLabel={t("stats.noIncomeInRange")} currency={currency} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-500">{t("stats.expenseByCategory")}</h2>
          <CategoryPieCard data={expenseByCategory} emptyLabel={t("stats.noExpenseInRange")} currency={currency} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">{t("stats.incomeVsExpense")}</h2>
        {timeline && timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, language)} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                labelFormatter={(d) => formatDate(String(d), language)}
                formatter={(v) => formatMoney(Number(v), currency)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="income"
                name={t("common.incomePlural")}
                stroke="#16a34a"
                strokeWidth={2}
                fill="url(#incomeFill)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name={t("categories.expenses")}
                stroke="#dc2626"
                strokeWidth={2}
                fill="url(#expenseFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">{t("stats.noTransactionsInRange")}</p>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{t("stats.transactionsTitle")}</h2>
        <Card className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto">
            <option value="">{t("stats.allCategories")}</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
            <option value="">{t("stats.allTypes")}</option>
            <option value="INCOME">{t("common.incomePlural")}</option>
            <option value="EXPENSE">{t("categories.expenses")}</option>
          </Select>
          <span className="ml-auto text-sm text-slate-500">
            {t("stats.filterBalance")}{" "}
            <span className={filteredTotal >= 0 ? "font-semibold text-income" : "font-semibold text-expense"}>
              {formatMoney(filteredTotal, currency)}
            </span>
          </span>
        </Card>

        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions?.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tx.category.color }}
                  />
                  <div>
                    <p className="text-sm font-medium">{tx.category.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(tx.date.slice(0, 10), language)}
                      {tx.description ? ` · ${tx.description}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-income" : "text-expense"}`}
                  >
                    {tx.type === "INCOME" ? "+" : "-"}
                    {formatMoney(tx.amount, currency)}
                  </span>
                  <button
                    onClick={() => setEditing(tx)}
                    className="text-xs text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(tx.id)}
                    className="text-xs text-slate-400 transition hover:text-red-600"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
            {transactions?.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">{t("stats.noTransactionsInRange")}</li>
            )}
          </ul>
        </Card>
      </div>

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
