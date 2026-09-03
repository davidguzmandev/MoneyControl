import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { Category, TransactionType } from "../types";
import { Button, Card, ErrorText, Input, Label } from "../components/ui";

const COLOR_PALETTE = [
  "#22c55e",
  "#ef4444",
  "#f97316",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#eab308",
  "#14b8a6",
  "#64748b",
  "#0ea5e9",
];

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories").then((r) => r.categories),
  });

  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.post<{ category: Category }>("/categories", { name, color, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setName("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Error al crear la categoría"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo borrar la categoría"),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    createMutation.mutate();
  }

  const incomeCategories = data?.filter((c) => c.type === "INCOME") ?? [];
  const expenseCategories = data?.filter((c) => c.type === "EXPENSE") ?? [];

  function CategoryList({ categories, emptyLabel }: { categories: Category[]; emptyLabel: string }) {
    return (
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-sm font-medium">{category.name}</span>
            </div>
            <button
              onClick={() => {
                setError(null);
                deleteMutation.mutate(category.id);
              }}
              className="text-xs text-slate-400 transition hover:text-red-600"
            >
              Eliminar
            </button>
          </li>
        ))}
        {categories.length === 0 && <li className="py-6 text-center text-sm text-slate-400">{emptyLabel}</li>}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-sm text-slate-500">Organiza tus movimientos por categoría.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("EXPENSE")}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                type === "EXPENSE"
                  ? "border-red-600 bg-red-50 text-red-600 dark:bg-red-950"
                  : "border-slate-200 text-slate-500 dark:border-slate-700"
              }`}
            >
              Categoría de gasto
            </button>
            <button
              type="button"
              onClick={() => setType("INCOME")}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                type === "INCOME"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-600 dark:bg-emerald-950"
                  : "border-slate-200 text-slate-500 dark:border-slate-700"
              }`}
            >
              Categoría de ingreso
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <Label htmlFor="categoryName">Nueva categoría</Label>
              <Input
                id="categoryName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mascotas"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-1.5">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ring-offset-2 transition ${
                      color === c ? "ring-2 ring-slate-900 dark:ring-slate-100" : ""
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              Agregar
            </Button>
          </div>
        </form>
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-emerald-600">Ingresos</h2>
          <CategoryList categories={incomeCategories} emptyLabel="No tienes categorías de ingreso todavía." />
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-red-600">Gastos</h2>
          <CategoryList categories={expenseCategories} emptyLabel="No tienes categorías de gasto todavía." />
        </Card>
      </div>
    </div>
  );
}
