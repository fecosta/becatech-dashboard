"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fontSize: 11, fill: "#6f6c62" }; // --muted
const GRID = "#e4e0d2"; // --border
const DEFAULT_BAR = "#a62bff"; // --purple

export interface BarDatum {
  name: string;
  value: number;
  color?: string;
}

function ChartCard({ title, height = 288, children }: { title: string; height?: number; children: React.ReactElement }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

export function BarCard({
  title,
  data,
  color = DEFAULT_BAR,
  horizontal = false,
  height,
}: {
  title: string;
  data: BarDatum[];
  color?: string;
  horizontal?: boolean;
  height?: number;
}) {
  if (horizontal) {
    return (
      <ChartCard title={title} height={height ?? Math.max(200, data.length * 34 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={160} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>
    );
  }
  return (
    <ChartCard title={title} height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

export function PieCard({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <ChartCard title={title}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ChartCard>
  );
}

export interface LineSeries {
  key: string;
  name: string;
  color: string;
}

export function LineCard({
  title,
  data,
  xKey,
  lines,
}: {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  lines: LineSeries[];
}) {
  return (
    <ChartCard title={title}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} />
        <Tooltip />
        <Legend />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} dot={{ r: 2 }} strokeWidth={2} />
        ))}
      </LineChart>
    </ChartCard>
  );
}

/** Bare donut (no ChartCard chrome) — for when the caller wants a custom legend next to it. */
export function Donut({
  data,
  size = 150,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
}) {
  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={size * 0.32}
            outerRadius={size * 0.5}
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bar + line combo (e.g. monthly activity volume with a participation-rate overlay). */
export function ComboBarLineCard({
  title,
  data,
  xKey,
  barKey,
  barName,
  barColor = DEFAULT_BAR,
  lineKey,
  lineName,
  lineColor = "#a62bff",
}: {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  barKey: string;
  barName: string;
  barColor?: string;
  lineKey: string;
  lineName: string;
  lineColor?: string;
}) {
  return (
    <ChartCard title={title}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} />
        <YAxis yAxisId="left" tick={AXIS_TICK} allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} unit="%" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey={barKey} name={barName} fill={barColor} opacity={0.55} radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={lineKey}
          name={lineName}
          stroke={lineColor}
          dot={{ r: 3 }}
          strokeWidth={2.5}
        />
      </ComposedChart>
    </ChartCard>
  );
}
