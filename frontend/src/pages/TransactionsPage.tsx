import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Category, Transaction } from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { Button, Card, Select } from "../components/ui";
import { Modal } from "../components/Modal";
import { TransactionForm } from "../components/TransactionForm";
import type { TransactionFormValues } from "../components/TransactionForm";

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories").then((r) => r.categories),
  });

  const queryParams = new URLSearchParams();
  if (categoryFilter) queryParams.set("categoryId", categoryFilter);
  if (typeFilter) queryParams.set("type", typeFilter);

  const { data: transactions } = useQuery({
    queryKey: ["transactions", categoryFilter, typeFilter],
    queryFn: () =>
      api
        .get<{ transactions: Transaction[] }>(`/transactions?${queryParams.toString()}`)
        .then((r) => r.transactions),
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

  const total = useMemo(() => {
    if (!transactions) return 0;
    return transactions.reduce((sum, t) => sum + (t.type === "INCOME" ? t.amount : -t.amount), 0);
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Movimientos</h1>
          <p className="text-sm text-slate-500">Todos tus ingresos y gastos registrados.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Nuevo movimiento</Button>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
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
          <span className={total >= 0 ? "font-semibold text-income" : "font-semibold text-expense"}>
            {formatMoney(total)}
          </span>
        </span>
      </Card>

      <Card>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {transactions?.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.category.color }} />
                <div>
                  <p className="text-sm font-medium">{t.category.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(t.date.slice(0, 10))}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${t.type === "INCOME" ? "text-income" : "text-expense"}`}>
                  {t.type === "INCOME" ? "+" : "-"}
                  {formatMoney(t.amount)}
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
