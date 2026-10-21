"use client";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Legend,
  Treemap,
  ComposedChart,
  Line,
} from "recharts";

const TOOLTIP_STYLE = {
  borderRadius: 10,
  fontSize: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
} as const;

export function TrendChart({
  data,
  formatValue,
  color,
}: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
  color?: string;
}) {
  const lineColor = color ?? "#C29A4E";
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={lineColor} stopOpacity={0.32} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatValue(v as number)}
        />
        <Tooltip
          formatter={(v) => formatValue(v as number)}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: "hsl(var(--gold))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          fill="url(#nwFill)"
          activeDot={{ r: 4, strokeWidth: 0 }}
          animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AllocationDonut({
  data,
  formatValue,
  centerLabel,
  centerSub,
}: {
  data: { name: string; value: number; color: string }[];
  formatValue: (v: number) => string;
  centerLabel?: string;
  centerSub?: string;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={64}
            outerRadius={100}
            paddingAngle={2}
            animationDuration={800}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} stroke="hsl(var(--card))" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => [formatValue(v as number), n as string]}
            contentStyle={TOOLTIP_STYLE}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerSub && (
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {centerSub}
            </span>
          )}
          <span className="font-serif text-lg font-semibold tabular-nums">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}

export function CashflowBars({
  data,
  formatValue,
}: {
  data: { label: string; Income: number; Expenses: number }[];
  formatValue: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatValue(v as number)}
        />
        <Tooltip formatter={(v) => formatValue(v as number)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Income" fill="#2E7D5B" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Expenses" fill="#8C3B4A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MultiTrendChart({
  data,
  series,
  formatValue,
}: {
  data: Record<string, number | string>[];
  series: { key: string; color: string }[];
  formatValue: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatValue(v as number)}
        />
        <Tooltip formatter={(v) => formatValue(v as number)} contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            fillOpacity={0.08}
            fill={s.color}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Tiny inline trend line (no axes) for use inside cards/rows. */
export function Sparkline({
  data,
  color = "#C29A4E",
  height = 34,
}: {
  data: { value: number }[];
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 3, bottom: 3, left: 0, right: 0 }}>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={color}
          fillOpacity={0.12}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface TreemapNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  color?: string;
}

function TreemapCell(props: TreemapNodeProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", color = "#94a3b8" } = props;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="hsl(var(--card))" strokeWidth={2} rx={6} />
      {width > 70 && height > 28 && (
        <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={500}>
          {name}
        </text>
      )}
    </g>
  );
}

export interface FanPoint {
  label: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export function FanChart({
  data,
  formatValue,
}: {
  data: FanPoint[];
  formatValue: (v: number) => string;
}) {
  const rows = data.map((d) => ({
    ...d,
    base: d.p10,
    s1: Math.max(0, d.p25 - d.p10),
    s2: Math.max(0, d.p75 - d.p25),
    s3: Math.max(0, d.p90 - d.p75),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatValue(v as number)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const row = payload[0].payload as FanPoint;
            return (
              <div style={TOOLTIP_STYLE as React.CSSProperties} className="px-2.5 py-2 text-xs">
                <div className="font-medium">{row.label}</div>
                <div>Median: {formatValue(row.p50)}</div>
                <div className="text-muted-foreground">
                  10-90%: {formatValue(row.p10)} - {formatValue(row.p90)}
                </div>
              </div>
            );
          }}
        />
        <Area dataKey="base" stackId="fan" stroke="none" fill="transparent" isAnimationActive={false} />
        <Area dataKey="s1" stackId="fan" stroke="none" fill="hsl(var(--gold))" fillOpacity={0.12} isAnimationActive={false} />
        <Area dataKey="s2" stackId="fan" stroke="none" fill="hsl(var(--gold))" fillOpacity={0.28} isAnimationActive={false} />
        <Area dataKey="s3" stackId="fan" stroke="none" fill="hsl(var(--gold))" fillOpacity={0.12} isAnimationActive={false} />
        <Line dataKey="p50" stroke="#1A2C4E" strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function AllocationTreemap({
  data,
  formatValue,
}: {
  data: { name: string; value: number; color: string }[];
  formatValue: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <Treemap
        data={data}
        dataKey="value"
        nameKey="name"
        animationDuration={700}
        content={<TreemapCell />}
      >
        <Tooltip formatter={(v, n) => [formatValue(v as number), n as string]} contentStyle={TOOLTIP_STYLE} />
      </Treemap>
    </ResponsiveContainer>
  );
}
