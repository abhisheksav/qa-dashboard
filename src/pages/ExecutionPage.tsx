import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  Ban,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Flag,
  ImagePlus,
  X,
  CircleDashed,
  StopCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge, PriorityBadge } from '@/components/shared/badges'
import { useDataStore } from '@/store/useDataStore'
import { runStats } from '@/lib/stats'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import type { CaseStatus, Priority, Severity } from '@/types'
import { PRIORITIES, SEVERITIES } from '@/types'

const statusIcon: Record<CaseStatus, typeof CheckCircle2> = {
  Passed: CheckCircle2,
  Failed: XCircle,
  Blocked: Ban,
  Skipped: SkipForward,
  'Not Executed': CircleDashed,
}

const statusIconCls: Record<CaseStatus, string> = {
  Passed: 'text-success-text',
  Failed: 'text-status-critical',
  Blocked: 'text-status-serious',
  Skipped: 'text-status-neutral',
  'Not Executed': 'text-faint',
}

export function ExecutionPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { runs, testCases, settings, recordResult, completeRun, abortRun, addBug } = useDataStore()

  const run = runs.find((r) => r.id === runId)
  const cases = useMemo(
    () =>
      (run?.caseIds ?? [])
        .map((id) => testCases.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => c != null),
    [run?.caseIds, testCases],
  )

  const [currentIdx, setCurrentIdx] = useState(0)
  const [actualResult, setActualResult] = useState('')
  const [comments, setComments] = useState('')
  const [bugFormOpen, setBugFormOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [abortOpen, setAbortOpen] = useState(false)
  const startedAtRef = useRef(Date.now())

  // Bug form state
  const [bugSummary, setBugSummary] = useState('')
  const [bugDescription, setBugDescription] = useState('')
  const [bugSeverity, setBugSeverity] = useState<Severity>('High')
  const [bugPriority, setBugPriority] = useState<Priority>('High')
  const [bugEnvironment, setBugEnvironment] = useState('')
  const [bugBuild, setBugBuild] = useState('')
  const [screenshot, setScreenshot] = useState<{ name: string; dataUrl: string } | null>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)

  const current = cases[currentIdx]

  useEffect(() => {
    startedAtRef.current = Date.now()
    if (run && current) {
      const existing = run.results[current.id]
      setActualResult(existing?.actualResult ?? '')
      setComments(existing?.comments ?? '')
    }
    setBugFormOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, current?.id])

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-muted-foreground">Run not found.</p>
        <Button variant="outline" onClick={() => navigate('/runs')}>Back to Test Runs</Button>
      </div>
    )
  }

  const stats = runStats(run)
  const isReadOnly = run.status !== 'In Progress'

  function record(status: CaseStatus, bugId?: string) {
    if (!run || !current) return
    recordResult(run.id, {
      caseId: current.id,
      status,
      actualResult:
        actualResult ||
        (status === 'Passed' ? 'Worked as expected' : status === 'Skipped' ? 'Skipped by tester' : ''),
      comments,
      bugId,
      executedAt: new Date().toISOString(),
      durationSec: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
    })
    advance()
  }

  function advance() {
    if (!run) return
    // find next case without a result, after current
    const executedIds = new Set(Object.keys(run.results))
    executedIds.add(current?.id ?? '')
    const nextIdx = cases.findIndex((c, i) => i > currentIdx && !executedIds.has(c.id))
    if (nextIdx >= 0) {
      setCurrentIdx(nextIdx)
    } else {
      const anyIdx = cases.findIndex((c) => !executedIds.has(c.id))
      if (anyIdx >= 0) setCurrentIdx(anyIdx)
      else setFinishOpen(true)
    }
  }

  function openBugForm() {
    if (!current || !run) return
    setBugSummary(`${current.id}: ${current.title} — failed on build ${run.build}`)
    setBugDescription(
      `Test Case: ${current.id} — ${current.title}\nModule: ${current.module}\n\nSteps to reproduce:\n${current.steps.map((s, i) => `${i + 1}. ${s.action}`).join('\n')}\n\nExpected: ${current.expectedResult}\nActual: ${actualResult || '(describe what happened)'}`,
    )
    setBugSeverity(current.priority === 'Critical' ? 'Critical' : 'High')
    setBugPriority(current.priority)
    setBugEnvironment(run.environment)
    setBugBuild(run.build)
    setScreenshot(null)
    setBugFormOpen(true)
  }

  function submitBugAndFail() {
    if (!run || !current) return
    if (!bugSummary.trim()) {
      toast.error('Bug summary required')
      return
    }
    const bug = addBug({
      summary: bugSummary.trim(),
      description: bugDescription,
      severity: bugSeverity,
      priority: bugPriority,
      status: 'Open',
      linkedCaseId: current.id,
      linkedRunId: run.id,
      assignedTo: settings.currentTester,
      environment: bugEnvironment,
      build: bugBuild,
      screenshotName: screenshot?.name,
      screenshotDataUrl: screenshot?.dataUrl,
    })
    toast.success(`Bug ${bug.id} logged`, bug.summary)
    setBugFormOpen(false)
    record('Failed', bug.id)
  }

  function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 1_000_000) {
      toast.error('Screenshot too large', 'Keep screenshots under 1 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setScreenshot({ name: file.name, dataUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  function handleFinish() {
    if (!run) return
    completeRun(run.id)
    setFinishOpen(false)
    toast.success('Run completed', `${run.id} recorded.`)
    navigate(`/runs/${run.id}`)
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div>
            <h1 className="font-semibold text-lg leading-tight">
              {run.id} — {run.suiteName}
            </h1>
            <p className="text-xs text-muted-foreground">
              {run.tester} · Build {run.build} · {run.environment} · {run.sprint}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isReadOnly ? (
              <Button variant="outline" onClick={() => navigate(`/runs/${run.id}`)}>
                View Results
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAbortOpen(true)}>
                  <StopCircle /> Abort
                </Button>
                <Button onClick={() => setFinishOpen(true)}>
                  <Flag /> Finish Run
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={stats.progress} className="flex-1" />
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {stats.executed}/{stats.total} executed · {stats.passRate}% pass
          </span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="p-2 h-fit lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Execution Sequence
          </p>
          <div className="space-y-0.5">
            {cases.map((c, i) => {
              const result = run.results[c.id]
              const status: CaseStatus = result?.status ?? 'Not Executed'
              const Icon = statusIcon[status]
              return (
                <button
                  key={c.id}
                  onClick={() => setCurrentIdx(i)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors cursor-pointer',
                    i === currentIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', statusIconCls[status])} />
                  <span className="font-medium shrink-0">{c.id}</span>
                  <span className="truncate text-xs text-muted-foreground">{c.title}</span>
                </button>
              )
            })}
          </div>
        </Card>

        {current ? (
          <div className="space-y-4 min-w-0">
            <Card className="p-5">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{current.id}</h2>
                    <Badge variant="secondary">{current.module}</Badge>
                    <PriorityBadge priority={current.priority} />
                    {run.results[current.id] && <StatusBadge status={run.results[current.id].status} />}
                  </div>
                  <p className="mt-1 text-base">{current.title}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx((i) => i - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentIdx === cases.length - 1}
                    onClick={() => setCurrentIdx((i) => i + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-1">Preconditions</h3>
                  <p className="text-sm">{current.preconditions || '—'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-1">Test Data</h3>
                  <p className="text-sm font-mono text-[13px]">{current.testData || '—'}</p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-medium text-muted-foreground mb-2">Steps</h3>
                <ol className="space-y-2">
                  {current.steps.map((s, i) => (
                    <li key={s.id} className="flex gap-3 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      <div>
                        <p>{s.action}</p>
                        {s.expected && <p className="text-xs text-muted-foreground mt-0.5">Expected: {s.expected}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-4 rounded-lg border bg-muted/40 p-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-1">Expected Result</h3>
                <p className="text-sm">{current.expectedResult || '—'}</p>
              </div>
            </Card>

            {!isReadOnly && (
              <Card className="p-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="exec-actual">Actual Result</Label>
                    <Textarea
                      id="exec-actual"
                      rows={2}
                      placeholder="What actually happened?"
                      value={actualResult}
                      onChange={(e) => setActualResult(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="exec-comments">Comments</Label>
                    <Textarea
                      id="exec-comments"
                      rows={2}
                      placeholder="Notes for this execution (optional)"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-status-good hover:bg-status-good/90 text-white"
                    onClick={() => record('Passed')}
                  >
                    <CheckCircle2 /> Pass
                  </Button>
                  <Button
                    className="bg-status-critical hover:bg-status-critical/90 text-white"
                    onClick={openBugForm}
                  >
                    <XCircle /> Fail
                  </Button>
                  <Button
                    className="bg-status-serious hover:bg-status-serious/90 text-white"
                    onClick={() => record('Blocked')}
                  >
                    <Ban /> Block
                  </Button>
                  <Button variant="secondary" onClick={() => record('Skipped')}>
                    <SkipForward /> Skip
                  </Button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">This run has no test cases.</Card>
        )}
      </div>

      {/* Fail → bug capture */}
      <Dialog open={bugFormOpen} onOpenChange={setBugFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Log Bug for {current?.id}</DialogTitle>
            <DialogDescription>
              A bug will be created and linked to this test case, then the case is marked Failed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bug-summary">Bug Summary</Label>
              <Input id="bug-summary" value={bugSummary} onChange={(e) => setBugSummary(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bug-desc">Bug Description</Label>
              <Textarea
                id="bug-desc"
                rows={6}
                className="font-mono text-[13px]"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Severity</Label>
                <Select value={bugSeverity} onValueChange={(v) => setBugSeverity(v as Severity)}>
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
                <Select value={bugPriority} onValueChange={(v) => setBugPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Environment</Label>
                <Select value={bugEnvironment} onValueChange={setBugEnvironment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.environments.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Build Version</Label>
                <Select value={bugBuild} onValueChange={setBugBuild}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.builds.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Screenshot</Label>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleScreenshot}
              />
              {screenshot ? (
                <div className="flex items-center gap-3 rounded-md border p-2">
                  <img src={screenshot.dataUrl} alt="Screenshot preview" className="h-12 w-12 rounded object-cover" />
                  <span className="flex-1 truncate text-sm">{screenshot.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => setScreenshot(null)}>
                    <X />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-fit" onClick={() => screenshotInputRef.current?.click()}>
                  <ImagePlus /> Attach Screenshot
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBugFormOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitBugAndFail}>
              <XCircle /> Log Bug & Mark Failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish */}
      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finish this run?</DialogTitle>
            <DialogDescription>
              {stats.executed} of {stats.total} cases executed ({stats.passed} passed, {stats.failed}{' '}
              failed, {stats.blocked} blocked, {stats.skipped} skipped).
              {stats.notExecuted > 0 && ` ${stats.notExecuted} will remain Not Executed.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishOpen(false)}>Keep Testing</Button>
            <Button onClick={handleFinish}>
              <Flag /> Complete Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Abort */}
      <Dialog open={abortOpen} onOpenChange={setAbortOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abort this run?</DialogTitle>
            <DialogDescription>
              The run is marked Aborted. Results recorded so far are kept in history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbortOpen(false)}>Keep Testing</Button>
            <Button
              variant="destructive"
              onClick={() => {
                abortRun(run.id)
                setAbortOpen(false)
                navigate(`/runs/${run.id}`)
              }}
            >
              <StopCircle /> Abort Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
