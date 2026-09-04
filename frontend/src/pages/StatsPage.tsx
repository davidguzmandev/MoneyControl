import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import type { BudgetSummary, Category, CategoryStat, Currency, Transaction, TimelinePoint } from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { Button, Card, Select } from "../components/ui";
import { Modal } from "../components/Modal";
import { TransactionForm } from "../components/TransactionForm";
import type { TransactionFormValues } from "../components/TransactionForm";
import { useAuth } from "../context/AuthContext";

type RangeOption = "period" | "30" | "90" | "all";

function CategoryPieCard({
  title,
  data,
  emptyLabel,
  currency,
}: {
  title: string;
  data: CategoryStat[] | undefined;
  emptyLabel: string;
  currency: Currency;
}) {
  const total = data?.reduce((sum, c) => sum + c.total, 0) ?? 0;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-slate-500">{title}</h2>
      {data && data.length > 0 ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                {data.map((c) => (
                  <Cell key={c.categoryId} fill={c.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="w-full space-y-1.5 text-sm">
            {data
              .slice()
              .sort((a, b) => b.total - a.total)
              .map((c) => (
                <li key={c.categoryId} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                  <span className="text-slate-500">
                    {formatMoney(c.total, currency)}{" "}
                    <span className="text-xs text-slate-400">
                      ({total ? Math.round((c.total / total) * 100) : 0}%)
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-400">{emptyLabel}</p>
      )}
    </Card>
  );
}

export function StatsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? "USD";
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeOption>("period");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data: budget } = useQuery({
    queryKey: ["budget", "summary"],
    queryFn: () => api.get<BudgetSummary>("/budget/summary"),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estadísticas y movimientos</h1>
          <p className="text-sm text-slate-500">Analiza tus ingresos y gastos, y consulta tus movimientos.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { key: "period", label: "Periodo actual" },
                { key: "30", label: "30 días" },
                { key: "90", label: "90 días" },
                { key: "all", label: "Todo" },
              ] as { key: RangeOption; label: string }[]
            ).map((opt) => (
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
          <Button onClick={() => setModalOpen(true)}>+ Nuevo movimiento</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryPieCard
          title="Ingresos por categoría"
          data={incomeByCategory}
          emptyLabel="No hay ingresos en este rango."
          currency={currency}
        />
        <CategoryPieCard
          title="Gastos por categoría"
          data={expenseByCategory}
          emptyLabel="No hay gastos en este rango."
          currency={currency}
        />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Ingresos vs. gastos por día</h2>
        {timeline && timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d)} fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                labelFormatter={(d) => formatDate(String(d))}
                formatter={(v) => formatMoney(Number(v), currency)}
              />
              <Legend />
              <Bar dataKey="income" name="Ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">No hay movimientos en este rango.</p>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Movimientos</h2>
        <Card className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto">
            <option value="">Todas las categorías</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
            <option value="">Todos los tipos</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Gastos</option>
          </Select>
          <span className="ml-auto text-sm text-slate-500">
            Balance del filtro:{" "}
            <span className={filteredTotal >= 0 ? "font-semibold text-income" : "font-semibold text-expense"}>
              {formatMoney(filteredTotal, currency)}
            </span>
          </span>
        </Card>

        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions?.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.category.color }}
                  />
                  <div>
                    <p className="text-sm font-medium">{t.category.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(t.date.slice(0, 10))}
                      {t.description ? ` · ${t.description}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${t.type === "INCOME" ? "text-income" : "text-expense"}`}
                  >
                    {t.type === "INCOME" ? "+" : "-"}
                    {formatMoney(t.amount, currency)}
                  </span>
                  <button
                    onClick={() => setEditing(t)}
                    className="text-xs text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(t.id)}
                    className="text-xs text-slate-400 transition hover:text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
            {transactions?.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">No hay movimientos en este rango.</li>
            )}
          </ul>
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo movimiento">
        <TransactionForm
          categories={categories ?? []}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar movimiento">
        {editing && (
          <TransactionForm
            categories={categories ?? []}
            initial={editing}
            submitLabel="Guardar cambios"
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
