import {
  CheckCircle2,
  XCircle,
  Ban,
  SkipForward,
  CircleDashed,
  AlertTriangle,
  AlertOctagon,
  ArrowDown,
  ArrowUp,
  Minus,
  ChevronsUp,
  Clock,
  Bot,
  Hand,
  CircleCheck,
  CircleSlash,
  Archive,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  BugStatus,
  CaseStatus,
  ExecutionType,
  LifecycleStatus,
  Priority,
  ReviewStatus,
  Severity,
  SuiteStatus,
  RunStatus,
} from '@/types'

// Status colors follow the reserved status palette and always pair icon + label,
// so state is never conveyed by color alone.

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const map: Record<CaseStatus, { icon: typeof CheckCircle2; cls: string }> = {
    Passed: { icon: CheckCircle2, cls: 'text-success-text bg-status-good/10 border-status-good/30' },
    Failed: { icon: XCircle, cls: 'text-status-critical bg-status-critical/10 border-status-critical/30' },
    Blocked: { icon: Ban, cls: 'text-status-serious bg-status-serious/10 border-status-serious/40' },
    Skipped: { icon: SkipForward, cls: 'text-muted-foreground bg-muted border-border' },
    'Not Executed': { icon: CircleDashed, cls: 'text-faint bg-transparent border-border' },
  }
  const { icon: Icon, cls } = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const map: Record<Priority, { icon: typeof ArrowUp; cls: string }> = {
    Critical: { icon: ChevronsUp, cls: 'text-status-critical' },
    High: { icon: ArrowUp, cls: 'text-status-serious' },
    Medium: { icon: Minus, cls: 'text-muted-foreground' },
    Low: { icon: ArrowDown, cls: 'text-faint' },
  }
  const { icon: Icon, cls } = map[priority]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap', cls, className)}>
      <Icon className="h-3.5 w-3.5" />
      {priority}
    </span>
  )
}

export function ExecutionTypeBadge({ type, className }: { type: ExecutionType; className?: string }) {
  const map: Record<ExecutionType, { icon: typeof Bot; cls: string }> = {
    Automated: { icon: Bot, cls: 'text-primary bg-primary/10 border-primary/30' },
    Manual: { icon: Hand, cls: 'text-muted-foreground bg-muted border-border' },
  }
  const { icon: Icon, cls } = map[type]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {type}
    </span>
  )
}

export function LifecycleStatusBadge({ status, className }: { status: LifecycleStatus; className?: string }) {
  const map: Record<LifecycleStatus, { icon: typeof CircleCheck; cls: string }> = {
    Active: { icon: CircleCheck, cls: 'text-success-text bg-status-good/10 border-status-good/30' },
    Inactive: { icon: CircleSlash, cls: 'text-muted-foreground bg-muted border-border' },
    Archived: { icon: Archive, cls: 'text-faint bg-transparent border-border border-dashed' },
  }
  const { icon: Icon, cls } = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const map: Record<Severity, { icon: typeof AlertTriangle; cls: string }> = {
    Critical: { icon: AlertOctagon, cls: 'text-status-critical bg-status-critical/10 border-status-critical/30' },
    High: { icon: AlertTriangle, cls: 'text-status-serious bg-status-serious/10 border-status-serious/40' },
    Medium: { icon: AlertTriangle, cls: 'text-status-warning bg-status-warning/10 border-status-warning/40' },
    Low: { icon: Minus, cls: 'text-muted-foreground bg-muted border-border' },
  }
  const { icon: Icon, cls } = map[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {severity}
    </span>
  )
}

export function BugStatusBadge({ status, className }: { status: BugStatus; className?: string }) {
  const cls: Record<BugStatus, string> = {
    Open: 'text-status-critical bg-status-critical/10 border-status-critical/30',
    Reopened: 'text-status-critical bg-status-critical/10 border-status-critical/30',
    'In Progress': 'text-primary bg-primary/10 border-primary/30',
    Fixed: 'text-success-text bg-status-good/10 border-status-good/30',
    Retest: 'text-status-warning bg-status-warning/10 border-status-warning/40',
    Closed: 'text-muted-foreground bg-muted border-border',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls[status],
        className,
      )}
    >
      {status}
    </span>
  )
}

export function ReviewStatusBadge({ status, className }: { status: ReviewStatus; className?: string }) {
  const map: Record<ReviewStatus, { icon: typeof CheckCircle2; cls: string }> = {
    Pending: { icon: Clock, cls: 'text-status-warning bg-status-warning/10 border-status-warning/40' },
    Approved: { icon: CheckCircle2, cls: 'text-success-text bg-status-good/10 border-status-good/30' },
    Rejected: { icon: XCircle, cls: 'text-status-critical bg-status-critical/10 border-status-critical/30' },
  }
  const { icon: Icon, cls } = map[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}

export function SuiteStatusBadge({ status, className }: { status: SuiteStatus; className?: string }) {
  const cls: Record<SuiteStatus, string> = {
    Active: 'text-success-text bg-status-good/10 border-status-good/30',
    Draft: 'text-muted-foreground bg-muted border-border',
    Archived: 'text-faint bg-transparent border-border',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls[status],
        className,
      )}
    >
      {status}
    </span>
  )
}

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const cls: Record<RunStatus, string> = {
    'In Progress': 'text-primary bg-primary/10 border-primary/30',
    Completed: 'text-success-text bg-status-good/10 border-status-good/30',
    Aborted: 'text-muted-foreground bg-muted border-border',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        cls[status],
        className,
      )}
    >
      {status}
    </span>
  )
}
