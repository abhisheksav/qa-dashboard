import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Search, Trash2, X, Bug as BugIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { SeverityBadge, BugStatusBadge, PriorityBadge } from '@/components/shared/badges'
import { useDataStore } from '@/store/useDataStore'
import { formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import type { Bug, BugStatus, Priority, Severity } from '@/types'
import { BUG_STATUSES, PRIORITIES, SEVERITIES } from '@/types'

const ALL = '__all__'
const NONE = '__none__'

interface BugFormValues {
  summary: string
  description: string
  severity: Severity
  priority: Priority
  status: BugStatus
  linkedCaseId: string
  assignedTo: string
  environment: string
  build: string
}

export function BugsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { bugs, testCases, settings, addBug, updateBug, deleteBug } = useDataStore()

  const q = searchParams.get('q') ?? ''
  const severityFilter = searchParams.get('severity') ?? ALL
  const statusFilter = searchParams.get('status') ?? ALL
  const assigneeFilter = searchParams.get('assignee') ?? ALL

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Bug | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const form = useForm<BugFormValues>()

  function setParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === ALL || value === '') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return [...bugs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((b) => {
        if (severityFilter !== ALL && b.severity !== severityFilter) return false
        if (statusFilter !== ALL && b.status !== statusFilter) return false
        if (assigneeFilter !== ALL && b.assignedTo !== assigneeFilter) return false
        if (query) {
          const hay = `${b.id} ${b.summary} ${b.linkedCaseId ?? ''} ${b.build}`.toLowerCase()
          if (!hay.includes(query)) return false
        }
        return true
      })
  }, [bugs, q, severityFilter, statusFilter, assigneeFilter])

  const openCount = bugs.filter((b) => ['Open', 'In Progress', 'Reopened', 'Retest'].includes(b.status)).length

  function openCreate() {
    setEditing(null)
    form.reset({
      summary: '',
      description: '',
      severity: 'Medium',
      priority: 'Medium',
      status: 'Open',
      linkedCaseId: NONE,
      assignedTo: settings.currentTester,
      environment: settings.defaultEnvironment,
      build: settings.defaultBuild,
    })
    setFormOpen(true)
  }

  function openEdit(bug: Bug) {
    setEditing(bug)
    form.reset({
      summary: bug.summary,
      description: bug.description,
      severity: bug.severity,
      priority: bug.priority,
      status: bug.status,
      linkedCaseId: bug.linkedCaseId ?? NONE,
      assignedTo: bug.assignedTo,
      environment: bug.environment,
      build: bug.build,
    })
    setFormOpen(true)
  }

  // Open the edit dialog automatically when navigated with ?q=BUG-xxx matching exactly one bug
  useEffect(() => {
    const exact = bugs.find((b) => b.id.toLowerCase() === q.trim().toLowerCase())
    if (exact) openEdit(exact)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onSubmit(values: BugFormValues) {
    const payload = {
      ...values,
      linkedCaseId: values.linkedCaseId === NONE ? undefined : values.linkedCaseId,
    }
    if (editing) {
      updateBug(editing.id, payload)
      toast.success('Bug updated', `${editing.id} saved.`)
    } else {
      const b = addBug({ ...payload, linkedRunId: undefined })
      toast.success('Bug created', `${b.id} added to the tracker.`)
    }
    setFormOpen(false)
  }

  const hasFilters = severityFilter !== ALL || statusFilter !== ALL || assigneeFilter !== ALL || q !== ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bug Tracker</h1>
          <p className="text-sm text-muted-foreground">
            {bugs.length} bugs total · {openCount} open
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> Report Bug
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder="Search by bug ID, summary, test case, build…"
              className="pl-9"
            />
          </div>
          <Select value={severityFilter} onValueChange={(v) => setParam('severity', v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Severities</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setParam('status', v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {BUG_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={(v) => setParam('assignee', v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Assignees</SelectItem>
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
                <TableHead>Bug ID</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Linked Case</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No bugs match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((bug) => (
                  <TableRow key={bug.id} className="cursor-pointer" onClick={() => openEdit(bug)}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <BugIcon className="h-3.5 w-3.5 text-status-critical" />
                        {bug.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[24rem] truncate" title={bug.summary}>
                        {bug.summary}
                      </span>
                    </TableCell>
                    <TableCell><SeverityBadge severity={bug.severity} /></TableCell>
                    <TableCell><PriorityBadge priority={bug.priority} /></TableCell>
                    <TableCell><BugStatusBadge status={bug.status} /></TableCell>
                    <TableCell>
                      {bug.linkedCaseId ? (
                        <Link
                          to={`/cases?q=${encodeURIComponent(bug.linkedCaseId)}`}
                          className="text-primary hover:underline whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {bug.linkedCaseId}
                        </Link>
                      ) : (
                        <span className="text-faint text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{bug.assignedTo}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {formatDate(bug.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingId(bug.id)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `${editing.id}` : 'Report Bug'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Reported ${formatDate(editing.createdAt)}${editing.linkedRunId ? ` during run ${editing.linkedRunId}` : ''}.`
                : 'Log a defect and optionally link it to a test case.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bug-summary">Summary</Label>
              <Input id="bug-summary" {...form.register('summary', { required: true })} />
              {form.formState.errors.summary && (
                <p className="text-xs text-destructive">Summary is required.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bug-description">Description</Label>
              <Textarea id="bug-description" rows={5} {...form.register('description')} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Severity</Label>
                <Select value={form.watch('severity')} onValueChange={(v) => form.setValue('severity', v as Severity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={form.watch('priority')} onValueChange={(v) => form.setValue('priority', v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as BugStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUG_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Linked Test Case</Label>
                <Select value={form.watch('linkedCaseId')} onValueChange={(v) => form.setValue('linkedCaseId', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {testCases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.id} — {c.title.slice(0, 40)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assigned To</Label>
                <Select value={form.watch('assignedTo')} onValueChange={(v) => form.setValue('assignedTo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.testers.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Build</Label>
                <Select value={form.watch('build')} onValueChange={(v) => form.setValue('build', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.builds.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing?.screenshotDataUrl && (
              <div className="grid gap-2">
                <Label>Screenshot</Label>
                <img
                  src={editing.screenshotDataUrl}
                  alt={editing.screenshotName ?? 'Bug screenshot'}
                  className="max-h-56 w-fit rounded-md border"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Create Bug'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete bug {deletingId}?</DialogTitle>
            <DialogDescription>
              The bug is removed and unlinked from any test cases.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingId) {
                  deleteBug(deletingId)
                  toast.success('Bug deleted', `${deletingId} removed.`)
                }
                setDeletingId(null)
              }}
            >
              <Trash2 /> Delete Bug
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
