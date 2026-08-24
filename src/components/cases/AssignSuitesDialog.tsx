import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useDataStore } from '@/store/useDataStore'
import { toast } from '@/components/ui/toaster'
import { Layers } from 'lucide-react'

interface AssignSuitesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseIds: string[]
  onDone?: () => void
}

export function AssignSuitesDialog({ open, onOpenChange, caseIds, onDone }: AssignSuitesDialogProps) {
  const { suites, testCases, assignCasesToSuites } = useDataStore()
  const [selected, setSelected] = useState<string[]>([])

  function handleAssign() {
    if (selected.length === 0) return
    assignCasesToSuites(caseIds, selected)
    const names = suites.filter((s) => selected.includes(s.id)).map((s) => s.name).join(', ')
    toast.success(
      'Assigned to suites',
      `${caseIds.length} test case${caseIds.length === 1 ? '' : 's'} added to ${names}.`,
    )
    setSelected([])
    onOpenChange(false)
    onDone?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setSelected([])
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Suites</DialogTitle>
          <DialogDescription>
            Assign {caseIds.length} selected test case{caseIds.length === 1 ? '' : 's'} to one or more
            suites. A case can belong to multiple suites.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {suites.map((s) => {
            const memberCount = testCases.filter(
              (c) => caseIds.includes(c.id) && c.suiteIds.includes(s.id),
            ).length
            return (
              <label
                key={s.id}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={(checked) =>
                    setSelected((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                  }
                />
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                {memberCount > 0 && (
                  <span className="text-xs text-faint">
                    {memberCount}/{caseIds.length} already in
                  </span>
                )}
              </label>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={selected.length === 0}>
            Assign to {selected.length || ''} Suite{selected.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
