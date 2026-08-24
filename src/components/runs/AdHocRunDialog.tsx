import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDataStore } from '@/store/useDataStore'
import { toast } from '@/components/ui/toaster'
import { PlayCircle } from 'lucide-react'

interface AdHocRunDialogProps {
  // Case IDs to execute; null closes the dialog.
  caseIds: string[] | null
  onOpenChange: (open: boolean) => void
}

export function AdHocRunDialog({ caseIds, onOpenChange }: AdHocRunDialogProps) {
  const navigate = useNavigate()
  const { settings, startAdHocRun } = useDataStore()
  const open = caseIds !== null && caseIds.length > 0

  const [tester, setTester] = useState(settings.currentTester)
  const [build, setBuild] = useState(settings.defaultBuild)
  const [environment, setEnvironment] = useState(settings.defaultEnvironment)
  const [sprint, setSprint] = useState(settings.sprints[settings.sprints.length - 1] ?? '')

  useEffect(() => {
    if (open) {
      setTester(settings.currentTester)
      setBuild(settings.defaultBuild)
      setEnvironment(settings.defaultEnvironment)
      setSprint(settings.sprints[settings.sprints.length - 1] ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleStart() {
    if (!caseIds) return
    const run = startAdHocRun(caseIds, { tester, build, environment, sprint })
    if (!run) {
      toast.error('Cannot start run', 'The selected case(s) are archived or no longer exist.')
      return
    }
    onOpenChange(false)
    navigate(`/execute/${run.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Execute {caseIds?.length === 1 ? caseIds[0] : `${caseIds?.length ?? 0} test cases`}</DialogTitle>
          <DialogDescription>
            Runs {caseIds?.length === 1 ? 'this case' : 'these cases'} without needing a suite.
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
          <Button onClick={handleStart}>
            <PlayCircle /> Start Execution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
