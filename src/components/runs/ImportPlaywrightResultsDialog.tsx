import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Upload, AlertTriangle, CheckCircle2, XCircle, SkipForward } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDataStore } from '@/store/useDataStore'
import { toast } from '@/components/ui/toaster'
import { formatDuration } from '@/lib/utils'
import { parsePlaywrightJson, type ParsedPWRun } from '@/lib/playwrightImport'

interface ImportPlaywrightResultsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const outcomeIcon = { Passed: CheckCircle2, Failed: XCircle, Skipped: SkipForward } as const
const outcomeCls = {
  Passed: 'text-success-text',
  Failed: 'text-status-critical',
  Skipped: 'text-status-neutral',
} as const

export function ImportPlaywrightResultsDialog({ open, onOpenChange }: ImportPlaywrightResultsDialogProps) {
  const navigate = useNavigate()
  const { suites, testCases, settings, importAutomatedRun } = useDataStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsed, setParsed] = useState<ParsedPWRun | null>(null)
  const [fileName, setFileName] = useState('')
  const [suiteId, setSuiteId] = useState('')
  const [tester, setTester] = useState('Playwright (CI)')
  const [build, setBuild] = useState(settings.defaultBuild)
  const [environment, setEnvironment] = useState(settings.defaultEnvironment)
  const [sprint, setSprint] = useState(settings.activeSprint || settings.sprints[settings.sprints.length - 1] || '')

  const matchedKnown = useMemo(
    () => (parsed ? parsed.matched.filter((m) => testCases.some((c) => c.id === m.caseId)) : []),
    [parsed, testCases],
  )
  const unknownIds = useMemo(
    () => (parsed ? [...new Set(parsed.matched.map((m) => m.caseId).filter((id) => !testCases.some((c) => c.id === id)))] : []),
    [parsed, testCases],
  )

  function reset() {
    setParsed(null)
    setFileName('')
  }

  function suggestSuite(matched: ParsedPWRun['matched']) {
    const ids = new Set(matched.map((m) => m.caseId))
    let best = suites[0]
    let bestCount = -1
    for (const s of suites) {
      const count = testCases.filter((c) => c.suiteIds.includes(s.id) && ids.has(c.id)).length
      if (count > bestCount) {
        best = s
        bestCount = count
      }
    }
    return best?.id ?? ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const result = parsePlaywrightJson(json)
      if (result.matched.length === 0) {
        toast.error(
          'No tagged tests found',
          'Tag test titles with a case ID, e.g. test(\'TC-025: ...\', ...), then re-export the JSON report.',
        )
        return
      }
      setParsed(result)
      setFileName(file.name)
      setSuiteId(suggestSuite(result.matched))
    } catch (err) {
      toast.error('Could not parse file', err instanceof Error ? err.message : 'Expected a Playwright JSON reporter file.')
    }
  }

  function handleImport() {
    if (!parsed || matchedKnown.length === 0 || !suiteId) return
    const suite = suites.find((s) => s.id === suiteId)
    if (!suite) return
    const run = importAutomatedRun({
      suiteId,
      suiteName: suite.name,
      tester,
      build,
      environment,
      sprint,
      startedAt: parsed.startedAt,
      results: matchedKnown.map((m) => ({
        caseId: m.caseId,
        status: m.status,
        actualResult: m.error ?? (m.status === 'Passed' ? 'Passed via Playwright' : ''),
        durationSec: m.durationSec,
      })),
    })
    if (!run) return
    const failed = matchedKnown.filter((m) => m.status === 'Failed').length
    toast.success(
      `${run.id} imported`,
      `${matchedKnown.length} results recorded${failed > 0 ? ` · ${failed} bug${failed === 1 ? '' : 's'} opened` : ''}.`,
    )
    onOpenChange(false)
    reset()
    navigate(`/runs/${run.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="h-4.5 w-4.5" /> Import Playwright Results</DialogTitle>
          <DialogDescription>
            Upload the JSON reporter output (<code className="text-[11px]">playwright test --reporter=json &gt; results.json</code>).
            Matches tests to cases by a <code className="text-[11px]">TC-###</code> tag in the test title.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10">
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
            <Upload className="h-6 w-6 text-faint" />
            <p className="text-sm text-muted-foreground">Drop the results.json here, or</p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose File
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium truncate max-w-[16rem]">{fileName}</span>
              <span className="text-muted-foreground">
                {matchedKnown.length} matched
                {unknownIds.length > 0 && ` · ${unknownIds.length} unknown TC ID${unknownIds.length === 1 ? '' : 's'}`}
                {parsed.unmatchedTitles.length > 0 && ` · ${parsed.unmatchedTitles.length} untagged`}
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={reset}>
                Choose a different file
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {matchedKnown.map((m) => {
                const Icon = outcomeIcon[m.status]
                return (
                  <div key={m.caseId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${outcomeCls[m.status]}`} />
                    <span className="font-medium shrink-0">{m.caseId}</span>
                    <span className="flex-1 truncate text-xs text-muted-foreground" title={m.title}>{m.title}</span>
                    <span className="text-xs text-faint tabular-nums shrink-0">{formatDuration(m.durationSec)}</span>
                  </div>
                )
              })}
            </div>

            {(unknownIds.length > 0 || parsed.unmatchedTitles.length > 0) && (
              <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {unknownIds.length > 0 && <>{unknownIds.join(', ')} tagged but not found in Test Cases. </>}
                  {parsed.unmatchedTitles.length > 0 && `${parsed.unmatchedTitles.length} test title(s) had no TC-### tag and will be skipped.`}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Suite</Label>
                <Select value={suiteId} onValueChange={setSuiteId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {suites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tester / CI Identity</Label>
                <Select value={tester} onValueChange={setTester}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Playwright (CI)">Playwright (CI)</SelectItem>
                    {settings.testers.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Build</Label>
                <Select value={build} onValueChange={setBuild}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.builds.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.environments.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 col-span-2">
                <Label>Sprint</Label>
                <Select value={sprint} onValueChange={setSprint}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.sprints.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={!parsed || matchedKnown.length === 0 || !suiteId}>
            <Bot /> Import {matchedKnown.length > 0 ? matchedKnown.length : ''} Result{matchedKnown.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
