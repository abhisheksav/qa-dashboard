import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDataStore } from '@/store/useDataStore'
import { toast } from '@/components/ui/toaster'
import { PlayCircle } from 'lucide-react'

interface StartRunDialogProps {
  suiteId: string | null
  onOpenChange: (open: boolean) => void
}

export function StartRunDialog({ suiteId, onOpenChange }: StartRunDialogProps) {
  const navigate = useNavigate()
  const { suites, testCases, settings, startRun } = useDataStore()
  const suite = suites.find((s) => s.id === suiteId)
  const caseCount = testCases.filter((c) => suiteId && c.suiteIds.includes(suiteId)).length

  const [tester, setTester] = useState(settings.currentTester)
  const [build, setBuild] = useState(settings.defaultBuild)
  const [environment, setEnvironment] = useState(settings.defaultEnvironment)
  const [sprint, setSprint] = useState(settings.activeSprint || settings.sprints[settings.sprints.length - 1] || '')

  useEffect(() => {
    if (suiteId) {
      setTester(settings.currentTester)
      setBuild(settings.defaultBuild)
      setEnvironment(settings.defaultEnvironment)
      setSprint(settings.activeSprint || settings.sprints[settings.sprints.length - 1] || '')
    }
  }, [suiteId, settings])

  function handleStart() {
    if (!suiteId) return
    const run = startRun(suiteId, { tester, build, environment, sprint })
    if (!run) {
      toast.error('Cannot start run', 'This suite has no test cases assigned.')
      return
    }
    onOpenChange(false)
    navigate(`/execute/${run.id}`)
  }

  return (
    <Dialog open={suiteId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run Suite: {suite?.name}</DialogTitle>
          <DialogDescription>
            {caseCount} test case{caseCount === 1 ? '' : 's'} will be executed in sequence.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Tester</Label>
            <Select value={tester} onValueChange={setTester}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.testers.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="grid gap-2">
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleStart} disabled={caseCount === 0}>
            <PlayCircle /> Start Execution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
