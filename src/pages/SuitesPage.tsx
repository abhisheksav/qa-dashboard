import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  PlayCircle,
  Layers,
  FileText,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SuiteStatusBadge } from '@/components/shared/badges'
import { StartRunDialog } from '@/components/shared/StartRunDialog'
import { useDataStore } from '@/store/useDataStore'
import { suiteLastRun, suiteProgress } from '@/lib/stats'
import { relativeTime } from '@/lib/utils'
import { statusColor } from '@/components/charts/chart-theme'
import { toast } from '@/components/ui/toaster'
import type { SuiteStatus, TestSuite } from '@/types'
import { SUITE_STATUSES } from '@/types'

interface SuiteFormValues {
  name: string
  description: string
  owner: string
  status: SuiteStatus
}

export function SuitesPage() {
  const navigate = useNavigate()
  const { suites, testCases, runs, settings, addSuite, updateSuite, deleteSuite, duplicateSuite } =
    useDataStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TestSuite | null>(null)
  const [deleting, setDeleting] = useState<TestSuite | null>(null)
  const [runSuiteId, setRunSuiteId] = useState<string | null>(null)

  const form = useForm<SuiteFormValues>({
    defaultValues: { name: '', description: '', owner: settings.currentTester, status: 'Active' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', description: '', owner: settings.currentTester, status: 'Active' })
    setFormOpen(true)
  }

  function openEdit(suite: TestSuite) {
    setEditing(suite)
    form.reset({
      name: suite.name,
      description: suite.description,
      owner: suite.owner,
      status: suite.status,
    })
    setFormOpen(true)
  }

  function onSubmit(values: SuiteFormValues) {
    if (editing) {
      updateSuite(editing.id, values)
      toast.success('Suite updated', `${values.name} saved.`)
    } else {
      const s = addSuite(values)
      toast.success('Suite created', `${s.name} (${s.id}) is ready. Assign test cases from the Test Cases page.`)
    }
    setFormOpen(false)
  }

  function confirmDelete() {
    if (!deleting) return
    deleteSuite(deleting.id)
    toast.success('Suite deleted', `${deleting.name} removed. Its test cases remain in the library.`)
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test Suites</h1>
          <p className="text-sm text-muted-foreground">
            Group test cases into executable suites — a case can live in many suites
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> Create Suite
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 stagger">
        {suites.map((suite) => {
          const stats = suiteProgress(testCases, suite.id)
          const lastRun = suiteLastRun(runs, suite.id)
          return (
            <Card key={suite.id} className="p-5 flex flex-col gap-3 hover-lift">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Layers className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{suite.name}</h3>
                    <SuiteStatusBadge status={suite.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {suite.description || suite.id}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(suite)}>
                      <Pencil /> Rename / Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const copy = duplicateSuite(suite.id)
                        if (copy) toast.success('Suite duplicated', `${copy.name} created with the same test cases.`)
                      }}
                    >
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/cases?suite=${suite.id}`)}>
                      <FileText /> View Test Cases
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(suite)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/60 py-2">
                  <p className="text-lg font-semibold leading-none">{stats.total}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Cases</p>
                </div>
                <div className="rounded-lg bg-muted/60 py-2">
                  <p className="text-lg font-semibold leading-none">{stats.progress}%</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Executed</p>
                </div>
                <div className="rounded-lg bg-muted/60 py-2">
                  <p className="text-lg font-semibold leading-none">{stats.passRate}%</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Pass Rate</p>
                </div>
              </div>

              {stats.total > 0 && (
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted gap-[2px]">
                  {(['Passed', 'Failed', 'Blocked', 'Skipped', 'Not Executed'] as const)
                    .filter((s) => stats.counts[s] > 0)
                    .map((s) => (
                      <span
                        key={s}
                        style={{ width: `${(stats.counts[s] / stats.total) * 100}%`, background: statusColor[s] }}
                        title={`${s}: ${stats.counts[s]}`}
                      />
                    ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-faint">
                <span>Owner: {suite.owner}</span>
                <span>
                  Last run:{' '}
                  {lastRun ? (
                    <button
                      className="underline-offset-2 hover:underline cursor-pointer"
                      onClick={() => navigate(`/runs/${lastRun.id}`)}
                    >
                      {relativeTime(lastRun.startedAt)}
                    </button>
                  ) : (
                    'never'
                  )}
                </span>
              </div>

              <Button
                className="mt-auto"
                variant="outline"
                onClick={() => setRunSuiteId(suite.id)}
                disabled={stats.total === 0}
              >
                <PlayCircle /> Execute Suite
              </Button>
            </Card>
          )
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Suite — ${editing.id}` : 'Create Suite'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the suite details.'
                : 'Create a new suite, then assign test cases to it from the Test Cases page.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="suite-name">Suite Name</Label>
              <Input
                id="suite-name"
                placeholder="e.g. Payments Regression"
                {...form.register('name', { required: true })}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">Suite name is required.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="suite-desc">Description</Label>
              <Textarea id="suite-desc" placeholder="What does this suite cover?" {...form.register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Owner</Label>
                <Select
                  value={form.watch('owner')}
                  onValueChange={(v) => form.setValue('owner', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.testers.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(v) => form.setValue('status', v as SuiteStatus)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUITE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save Changes' : 'Create Suite'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete suite “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              The suite and its membership links will be removed. Test cases and past run history are
              kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 /> Delete Suite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StartRunDialog suiteId={runSuiteId} onOpenChange={(o) => !o && setRunSuiteId(null)} />
    </div>
  )
}
