// Chart colors reference CSS custom properties so every chart re-skins itself
// when the theme toggles. Status colors are reserved for pass/fail semantics;
// categorical slots are assigned in fixed order per the palette.

export const chart = {
  series: [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--chart-6)',
    'var(--chart-7)',
    'var(--chart-8)',
  ],
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
  critical: 'var(--status-critical)',
  neutral: 'var(--status-neutral)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  muted: 'var(--faint)',
}

export const statusColor: Record<string, string> = {
  Passed: chart.good,
  Failed: chart.critical,
  Blocked: chart.serious,
  Skipped: chart.neutral,
  'Not Executed': 'var(--border)',
}

export const severityColor: Record<string, string> = {
  Critical: chart.critical,
  High: chart.serious,
  Medium: chart.warning,
  Low: chart.good,
}

export const executionTypeColor: Record<string, string> = {
  Manual: chart.series[0],
  Automated: chart.series[1],
}

export const axisTick = { fill: 'var(--faint)', fontSize: 11 }

interface TooltipRow {
  name: string
  value: number | string
  color?: string
}

export function ChartTooltipCard({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-md text-xs min-w-[8rem]">
      {title && <p className="text-muted-foreground mb-1.5">{title}</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            {r.color && (
              <span className="inline-block h-0.5 w-3 rounded-full shrink-0" style={{ background: r.color }} />
            )}
            <span className="font-semibold tabular-nums text-foreground">{r.value}</span>
            <span className="text-muted-foreground truncate">{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Generic Recharts tooltip adapter
export function RTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name?: string; value?: number | string; color?: string; fill?: string; dataKey?: string | number }[]
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <ChartTooltipCard
      title={label != null ? String(label) : undefined}
      rows={payload.map((p) => ({
        name: String(p.name ?? p.dataKey ?? ''),
        value: p.value ?? '',
        color: p.color ?? p.fill,
      }))}
    />
  )
}

export function ChartLegend({ items }: { items: { label: string; color: string; shape?: 'line' | 'rect' }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.shape === 'line' ? (
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: it.color }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  )
}
