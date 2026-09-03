import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Category, Transaction, TransactionType } from "../types";
import { todayISODate } from "../lib/format";
import { Button, ErrorText, Input, Label, Select } from "./ui";

export interface TransactionFormValues {
  type: TransactionType;
  amount: number;
  categoryId: string;
  description: string;
  date: string;
}

export function TransactionForm({
  categories,
  initial,
  submitLabel = "Guardar",
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  initial?: Partial<Transaction>;
  submitLabel?: string;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(initial?.amount !== undefined ? String(initial.amount) : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");

  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    const stillValid = filteredCategories.some((c) => c.id === categoryId);
    if (!stillValid) {
      setCategoryId(filteredCategories[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories]);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? todayISODate());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    if (!categoryId) {
      setError("Selecciona una categoría");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ type, amount: parsedAmount, categoryId, description, date });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          Gasto
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
          Ingreso
        </button>
      </div>

      <div>
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          type="number"
          min={0.01}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div>
        <Label htmlFor="categoryId">Categoría</Label>
        <Select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {filteredCategories.length === 0 && (
            <option value="">
              {categories.length === 0 ? "Cargando categorías..." : "No tienes categorías de este tipo"}
            </option>
          )}
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading || filteredCategories.length === 0}>
          {loading ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
