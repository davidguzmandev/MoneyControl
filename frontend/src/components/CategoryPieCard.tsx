import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryStat, Currency } from "../types";
import { formatMoney } from "../lib/format";

export function CategoryPieCard({
  data,
  emptyLabel,
  currency,
}: {
  data: CategoryStat[] | undefined;
  emptyLabel: string;
  currency: Currency;
}) {
  const total = data?.reduce((sum, c) => sum + c.total, 0) ?? 0;

  if (!data || data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[220px] w-full shrink-0 sm:w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              innerRadius={62}
              outerRadius={95}
              paddingAngle={2}
              cornerRadius={8}
              isAnimationActive={false}
            >
              {data.map((c) => (
                <Cell key={c.categoryId} fill={c.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400">Total</span>
          <span className="text-lg font-semibold">{formatMoney(total, currency)}</span>
        </div>
      </div>
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
  );
}
