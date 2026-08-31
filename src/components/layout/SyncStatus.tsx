import { useEffect, useState } from 'react'
import { Check, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { onSyncStateChange, type SyncState } from '@/services/remoteSync'

// Small header affordance answering "is my work actually saved to the
// database?". Renders nothing when no API is configured, so a local-only run
// of the app doesn't show a permanently idle-looking indicator.
export function SyncStatus() {
  const [state, setState] = useState<SyncState>('disabled')
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      onSyncStateChange((s, e) => {
        setState(s)
        setError(e)
      }),
    [],
  )

  if (state === 'disabled') return null

  const view = {
    connecting: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: 'Connecting',
      tip: 'Loading the shared workspace…',
      className: 'text-muted-foreground',
    },
    saving: {
      icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
      label: 'Saving',
      tip: 'Saving changes to the database…',
      className: 'text-muted-foreground',
    },
    synced: {
      icon: <Check className="h-3.5 w-3.5" />,
      label: 'Synced',
      tip: 'All changes are saved.',
      className: 'text-status-good',
    },
    error: {
      icon: <TriangleAlert className="h-3.5 w-3.5" />,
      label: 'Sync error',
      tip: error ?? 'Could not reach the API. Changes are kept in this browser.',
      className: 'text-status-critical',
    },
  }[state]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${view.className}`}
          role="status"
          aria-live="polite"
        >
          {view.icon}
          {view.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{view.tip}</TooltipContent>
    </Tooltip>
  )
}
