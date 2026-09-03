import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { BudgetSummary, CategoryStat, TimelinePoint } from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { Card } from "../components/ui";

type RangeOption = "period" | "30" | "90" | "all";

export function StatsPage() {
  const [range, setRange] = useState<RangeOption>("period");

  const { data: budget } = useQuery({
    queryKey: ["budget", "summary"],
    queryFn: () => api.get<BudgetSummary>("/budget/summary"),
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

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data: byCategory } = useQuery({
    queryKey: ["stats", "by-category", from, to],
    queryFn: () =>
      api.get<{ categories: CategoryStat[] }>(`/stats/by-category?${params.toString()}`).then((r) => r.categories),
  });

  const { data: timeline } = useQuery({
    queryKey: ["stats", "timeline", from, to],
    queryFn: () =>
      api.get<{ timeline: TimelinePoint[] }>(`/stats/timeline?${params.toString()}`).then((r) => r.timeline),
  });

  const totalExpense = byCategory?.reduce((sum, c) => sum + c.total, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estadísticas</h1>
          <p className="text-sm text-slate-500">Analiza tus gastos e ingresos a lo largo del tiempo.</p>
        </div>
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Gastos por categoría</h2>
          {byCategory && byCategory.length > 0 ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    isAnimationActive={false}
                  >
                    {byCategory.map((c) => (
                      <Cell key={c.categoryId} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="w-full space-y-1.5 text-sm">
                {byCategory
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((c) => (
                    <li key={c.categoryId} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                      <span className="text-slate-500">
                        {formatMoney(c.total)}{" "}
                        <span className="text-xs text-slate-400">
                          ({totalExpense ? Math.round((c.total / totalExpense) * 100) : 0}%)
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No hay gastos en este rango.</p>
          )}
        </Card>

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
                  formatter={(v) => formatMoney(Number(v))}
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
      </div>
    </div>
  );
}
