import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: number | string
  icon?: LucideIcon
  iconClassName?: string
  sub?: string
  onClick?: () => void
}

export function KpiCard({ label, value, icon: Icon, iconClassName, sub, onClick }: KpiCardProps) {
  return (
    <Card
      className={cn('p-4 flex items-start justify-between gap-2', onClick && 'cursor-pointer hover-lift hover:border-ring/40')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-faint mt-1.5 truncate">{sub}</p>}
      </div>
      {Icon && (
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted', iconClassName)}>
          <Icon className="h-4 w-4" />
        </span>
      )}
    </Card>
  )
}
