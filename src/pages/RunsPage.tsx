import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Trash2, X, PlayCircle, Bot } from 'lucide-react'
import { ImportPlaywrightResultsDialog } from '@/components/runs/ImportPlaywrightResultsDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RunStatusBadge } from '@/components/shared/badges'
import { useDataStore } from '@/store/useDataStore'
import { runStats } from '@/lib/stats'
import { formatDateTime, formatDuration } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

const ALL = '__all__'

export function RunsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { runs, suites, settings, deleteRun } = useDataStore()
  const [q, setQ] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const buildFilter = searchParams.get('build') ?? ALL
  const suiteFilter = searchParams.get('suite') ?? ALL
  const testerFilter = searchParams.get('tester') ?? ALL

  useEffect(() => {
    if (searchParams.get('import') === 'playwright') {
      setImportOpen(true)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('import')
          return next
        },
        { replace: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === ALL) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  const builds = useMemo(() => [...new Set(runs.map((r) => r.build))].sort().reverse(), [runs])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return [...runs]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .filter((r) => {
        if (buildFilter !== ALL && r.build !== buildFilter) return false
        if (suiteFilter !== ALL && r.suiteId !== suiteFilter) return false
        if (testerFilter !== ALL && r.tester !== testerFilter) return false
        if (query) {
          const hay = `${r.id} ${r.suiteName} ${r.build} ${r.tester}`.toLowerCase()
          if (!hay.includes(query)) return false
        }
        return true
      })
  }, [runs, q, buildFilter, suiteFilter, testerFilter])

  const hasFilters = buildFilter !== ALL || suiteFilter !== ALL || testerFilter !== ALL

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test Runs</h1>
          <p className="text-sm text-muted-foreground">
            Every execution is stored — {runs.length} runs recorded
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Bot /> Import Playwright Results
          </Button>
          <Button onClick={() => navigate('/suites')}>
            <PlayCircle /> Start New Run
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by run ID, suite, build, tester…"
              className="pl-9"
            />
          </div>
          <Select value={suiteFilter} onValueChange={(v) => setParam('suite', v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Suite" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Suites</SelectItem>
              {suites.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={buildFilter} onValueChange={(v) => setParam('build', v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Build" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Builds</SelectItem>
              {builds.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={testerFilter} onValueChange={(v) => setParam('tester', v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Testers</SelectItem>
              {settings.testers.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
              <X /> Clear
            </Button>
          )}
        </div>

        <div className="mt-3 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Run ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Tester</TableHead>
                <TableHead>Suite</TableHead>
                <TableHead>Build</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pass Rate</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Blocked</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                    No runs match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((run) => {
                  const stats = runStats(run)
                  return (
                    <TableRow
                      key={run.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/runs/${run.id}`)}
                    >
                      <TableCell className="font-medium whitespace-nowrap">{run.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(run.startedAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{run.tester}</TableCell>
                      <TableCell className="whitespace-nowrap">{run.suiteName}</TableCell>
                      <TableCell className="whitespace-nowrap">{run.build}</TableCell>
                      <TableCell><RunStatusBadge status={run.status} /></TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{stats.passRate}%</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatDuration(stats.durationSec)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-success-text">{stats.passed}</TableCell>
                      <TableCell className="text-right tabular-nums text-status-critical">{stats.failed}</TableCell>
                      <TableCell className="text-right tabular-nums text-status-serious">{stats.blocked}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingId(run.id)
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete run {deletingId}?</DialogTitle>
            <DialogDescription>
              The run and its recorded results are removed from history. Test case statuses are not
              changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingId) {
                  deleteRun(deletingId)
                  toast.success('Run deleted', `${deletingId} removed from history.`)
                }
                setDeletingId(null)
              }}
            >
              <Trash2 /> Delete Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportPlaywrightResultsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
