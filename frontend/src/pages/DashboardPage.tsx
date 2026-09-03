import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { BudgetSummary, Category, Transaction } from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { Button, Card } from "../components/ui";
import { Modal } from "../components/Modal";
import { TransactionForm } from "../components/TransactionForm";
import type { TransactionFormValues } from "../components/TransactionForm";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: budget } = useQuery({
    queryKey: ["budget", "summary"],
    queryFn: () => api.get<BudgetSummary>("/budget/summary"),
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

  const todayAllowance = budget?.todayAllowance ?? 0;
  const spentToday = budget?.spentToday ?? 0;
  const remainingToday = budget?.remainingToday ?? 0;
  const progressPct = todayAllowance > 0 ? Math.min(100, (spentToday / todayAllowance) * 100) : 0;
  const overBudget = remainingToday < 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
          {budget && (
            <p className="text-sm text-slate-500">
              Periodo actual: {formatDate(budget.periodStart)} — {formatDate(budget.periodEnd)}
            </p>
          )}
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Nuevo movimiento</Button>
      </div>

      <Card className="text-center">
        <p className="text-sm text-slate-500">Puedes gastar hoy</p>
        <p className={`my-2 text-4xl font-semibold tracking-tight ${overBudget ? "text-expense" : ""}`}>
          {formatMoney(remainingToday)}
        </p>
        <div className="mx-auto h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${overBudget ? "bg-red-600" : "bg-slate-900 dark:bg-slate-100"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Gastado hoy {formatMoney(spentToday)} de {formatMoney(todayAllowance)} asignados
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">Presupuesto mensual</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(budget?.monthlyBudget ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Gastado en el periodo</p>
          <p className="mt-1 text-lg font-semibold text-expense">{formatMoney(budget?.spentSoFar ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Restante del mes</p>
          <p className="mt-1 text-lg font-semibold text-income">{formatMoney(budget?.remainingMonthly ?? 0)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Movimientos recientes</h2>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {transactions?.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.category.color }} />
                <div>
                  <p className="text-sm font-medium">{t.category.name}</p>
                  <p className="text-xs text-slate-400">{formatDate(t.date.slice(0, 10))}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${t.type === "INCOME" ? "text-income" : "text-expense"}`}>
                {t.type === "INCOME" ? "+" : "-"}
                {formatMoney(t.amount)}
              </span>
            </li>
          ))}
          {transactions?.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-400">No hay movimientos todavía.</li>
          )}
        </ul>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo movimiento">
        <TransactionForm
          categories={categories ?? []}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
