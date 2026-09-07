import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type { BudgetSummary, Category, CategoryStat, Currency, TransactionType } from "../types";
import { formatMoney, todayISODate } from "../lib/format";
import { Button, Card, ErrorText, Input, Label } from "../components/ui";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

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
  const { user } = useAuth();
  const { t } = useLanguage();
  const currency = user?.currency ?? "USD";
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ categories: Category[] }>("/categories").then((r) => r.categories),
  });

  const { data: budget } = useQuery({
    queryKey: ["budget", "summary"],
    queryFn: () => api.get<BudgetSummary>(`/budget/summary?date=${todayISODate()}`),
  });

  const periodParams = new URLSearchParams();
  if (budget) {
    periodParams.set("from", budget.periodStart);
    periodParams.set("to", budget.periodEnd);
  }
  periodParams.set("type", "EXPENSE");

  const { data: spentByCategory } = useQuery({
    queryKey: ["stats", "by-category", "EXPENSE", budget?.periodStart, budget?.periodEnd],
    queryFn: () =>
      api
        .get<{ categories: CategoryStat[] }>(`/stats/by-category?${periodParams.toString()}`)
        .then((r) => r.categories),
    enabled: !!budget,
  });

  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.post<{ category: Category }>("/categories", { name, color, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      setName("");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("categories.createError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("categories.deleteError")),
  });

  const budgetMutation = useMutation({
    mutationFn: ({ id, monthlyBudget }: { id: string; monthlyBudget: number | null }) =>
      api.patch<{ category: Category }>(`/categories/${id}`, { monthlyBudget }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) =>
      api.patch<{ category: Category }>(`/categories/${id}`, { name, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setEditing(null);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    createMutation.mutate();
  }

  const incomeCategories = data?.filter((c) => c.type === "INCOME") ?? [];
  const expenseCategories = data?.filter((c) => c.type === "EXPENSE") ?? [];
  const spentMap = new Map((spentByCategory ?? []).map((s) => [s.categoryId, s.total]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("nav.categories")}</h1>
        <p className="text-sm text-slate-500">{t("categories.subtitle")}</p>
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
              {t("categories.expenseType")}
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
              {t("categories.incomeType")}
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <Label htmlFor="categoryName">{t("categories.newCategory")}</Label>
              <Input
                id="categoryName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("categories.namePlaceholder")}
              />
            </div>
            <div>
              <Label>{t("common.color")}</Label>
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
              {t("common.add")}
            </Button>
          </div>
        </form>
        <div className="mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-emerald-600">{t("categories.incomes")}</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {incomeCategories.map((category) => (
              <li key={category.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditing(category)}
                    className="text-xs text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={() => {
                      setError(null);
                      deleteMutation.mutate(category.id);
                    }}
                    className="text-xs text-slate-400 transition hover:text-red-600"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
            {incomeCategories.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">{t("categories.noIncomeCategories")}</li>
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-red-600">{t("categories.expenses")}</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenseCategories.map((category) => (
              <ExpenseCategoryRow
                key={category.id}
                category={category}
                spent={spentMap.get(category.id) ?? 0}
                currency={currency}
                onEdit={() => setEditing(category)}
                onDelete={() => {
                  setError(null);
                  deleteMutation.mutate(category.id);
                }}
                onSaveBudget={(monthlyBudget) =>
                  budgetMutation.mutateAsync({ id: category.id, monthlyBudget })
                }
              />
            ))}
            {expenseCategories.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">{t("categories.noExpenseCategories")}</li>
            )}
          </ul>
        </Card>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("categories.editTitle")}>
        {editing && (
          <CategoryEditForm
            category={editing}
            onSubmit={(vars) => updateMutation.mutateAsync(vars)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function CategoryEditForm({
  category,
  onSubmit,
  onCancel,
}: {
  category: Category;
  onSubmit: (vars: { id: string; name: string; color: string }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ id: category.id, name: name.trim(), color });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("categories.saveError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="editCategoryName">{t("common.name")}</Label>
        <Input id="editCategoryName" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>{t("common.color")}</Label>
        <div className="flex flex-wrap gap-1.5">
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
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? t("common.saving") : t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}

function ExpenseCategoryRow({
  category,
  spent,
  currency,
  onEdit,
  onDelete,
  onSaveBudget,
}: {
  category: Category;
  spent: number;
  currency: Currency;
  onEdit: () => void;
  onDelete: () => void;
  onSaveBudget: (monthlyBudget: number | null) => Promise<unknown>;
}) {
  const { t } = useLanguage();
  const [budgetInput, setBudgetInput] = useState(category.monthlyBudget !== null ? String(category.monthlyBudget) : "");
  const [budgetError, setBudgetError] = useState<string | null>(null);

  useEffect(() => {
    setBudgetInput(category.monthlyBudget !== null ? String(category.monthlyBudget) : "");
  }, [category.monthlyBudget]);

  async function commitBudget() {
    const trimmed = budgetInput.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed === category.monthlyBudget) return;
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) return;
    setBudgetError(null);
    try {
      await onSaveBudget(parsed);
    } catch (err) {
      setBudgetError(err instanceof ApiError ? err.message : t("categories.budgetSaveError"));
      setBudgetInput(category.monthlyBudget !== null ? String(category.monthlyBudget) : "");
    }
  }

  const hasBudget = category.monthlyBudget !== null && category.monthlyBudget > 0;
  const pct = hasBudget ? Math.min(100, (spent / category.monthlyBudget!) * 100) : 0;
  const over = hasBudget && spent > category.monthlyBudget!;

  return (
    <li className="py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="text-sm font-medium">{category.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="text-xs text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          >
            {t("common.edit")}
          </button>
          <button onClick={onDelete} className="text-xs text-slate-400 transition hover:text-red-600">
            {t("common.delete")}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 pl-6">
        <span className="text-xs text-slate-400">{t("categories.budgetLabel")}</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder={t("categories.noLimit")}
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          onBlur={commitBudget}
          className="h-7 w-28 px-2 py-1 text-xs"
        />
        {hasBudget && (
          <span className={`text-xs ${over ? "text-expense" : "text-slate-400"}`}>
            {formatMoney(spent, currency)} / {formatMoney(category.monthlyBudget!, currency)}
          </span>
        )}
      </div>
      {hasBudget && (
        <div className="mt-1.5 ml-6 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${over ? "bg-red-600" : "bg-slate-900 dark:bg-slate-100"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {budgetError && <p className="mt-1 pl-6 text-xs text-red-600">{budgetError}</p>}
    </li>
  );
}
