import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0d9488', '#db2777', '#ea7c12', '#64748b', '#b8922a', '#dc2626'];

function Tip({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <div className="l">{label}</div>}
      {payload.map((p) => (
        <div className="r" key={p.dataKey || p.name}>
          <span className="sw" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: {fmt ? fmt(p.value) : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </div>
      ))}
    </div>
  );
}

export function AreaTrend({ data, x = 'label', series, height = 260, fmt }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} tickFormatter={fmt} />
        <Tooltip content={<Tip fmt={fmt} />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '4 4' }} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} fill={`url(#g-${s.key})`}
            dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({ data, x = 'label', series, height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={x} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip content={<Tip />} />
        {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: s.color }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, x = 'label', series, height = 240, stacked, layout = 'horizontal', fmt }) {
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 6, right: 8, left: vertical ? 10 : -14, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={vertical} horizontal={!vertical} strokeDasharray="3 3" />
        {vertical ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey={x} tickLine={false} axisLine={false} width={78} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} tickFormatter={fmt} />
          </>
        )}
        <Tooltip content={<Tip fmt={fmt} />} cursor={{ fill: 'var(--surface-3)' }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined}
            radius={stacked ? (i === series.length - 1 ? [5, 5, 0, 0] : 0) : vertical ? [0, 5, 5, 0] : [5, 5, 0, 0]} maxBarSize={vertical ? 18 : 34} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 200, center, sub, colors = PALETTE, inner = 62, outer = 88 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="donut-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={inner} outerRadius={outer} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((d, i) => <Cell key={d.name} fill={d.color || colors[i % colors.length]} />)}
          </Pie>
          <Tooltip content={<Tip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center"><div><strong>{center ?? total.toLocaleString()}</strong><span>{sub}</span></div></div>
    </div>
  );
}

export function Legend({ data, colors = PALETTE, showPct = true }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="legend">
      {data.map((d, i) => (
        <div className="legend-item" key={d.name}>
          <span className="sw" style={{ background: d.color || colors[i % colors.length] }} />
          <span className="truncate">{d.name}</span>
          <span className="v">{d.value.toLocaleString()}</span>
          {showPct && <span className="p">{Math.round((d.value / total) * 100)}%</span>}
        </div>
      ))}
    </div>
  );
}

export function Spark({ data, k, color = '#2563eb', height = 34 }) {
  return (
    <div className="spark" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs><linearGradient id={`sp-${k}-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey={k} stroke={color} strokeWidth={2} fill={`url(#sp-${k}-${color.slice(1)})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
