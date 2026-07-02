"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fontSize: 11, fill: "#64748b" };
const GRID = "#e2e8f0";

export interface BarDatum {
  name: string;
  value: number;
  color?: string;
}

function ChartCard({ title, height = 288, children }: { title: string; height?: number; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

export function BarCard({
  title,
  data,
  color = "#6366f1",
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
