import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function Sparkline({
  data,
  dataKey,
  color,
  height = 40,
}: {
  data: Record<string, number | string>[];
  dataKey: string;
  color: string;
  height?: number;
}) {
  const gradientId = useId();

  if (!data || data.length === 0) {
    return <div style={{ height }} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
