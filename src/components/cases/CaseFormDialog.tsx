import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Plus, Trash2, GripVertical, History as HistoryIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/badges'
import { useDataStore } from '@/store/useDataStore'
import { toast } from '@/components/ui/toaster'
import { uid, formatDateTime, formatDuration } from '@/lib/utils'
import { caseExecutionHistory } from '@/lib/stats'
import type { CaseStatus, ExecutionType, LifecycleStatus, Priority, TestCase } from '@/types'
import { CASE_STATUSES, EXECUTION_TYPES, LIFECYCLE_STATUSES, PRIORITIES } from '@/types'

interface CaseFormValues {
  title: string
  module: string
  category: string
  priority: Priority
  executionType: ExecutionType
  automationRemark: string
  lifecycleStatus: LifecycleStatus
  storyId: string
  preconditions: string
  steps: { id: string; action: string; expected?: string }[]
  testData: string
  expectedResult: string
  actualResult: string
  status: CaseStatus
  comments: string
  sprint: string
  suiteIds: string[]
}

interface CaseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: TestCase | null
  defaultModule?: string
}

export function CaseFormDialog({ open, onOpenChange, editing, defaultModule }: CaseFormDialogProps) {
  const { suites, settings, runs, addCase, updateCase } = useDataStore()

  // Include the edited case's module even if it is no longer in settings,
  // so the Select can still display and keep it.
  const moduleOptions =
    editing && !settings.modules.includes(editing.module)
      ? [editing.module, ...settings.modules]
      : settings.modules
  const categoryOptions =
    editing?.category && !settings.categories.includes(editing.category)
      ? [editing.category, ...settings.categories]
      : settings.categories

  const history = useMemo(
    () => (editing ? caseExecutionHistory(runs, editing.id) : []),
    [runs, editing],
  )

  const form = useForm<CaseFormValues>({
    defaultValues: {
      title: '',
      module: defaultModule ?? settings.modules[0] ?? 'General',
      category: settings.categories[0] ?? '',
      priority: 'Medium',
      executionType: 'Manual',
      automationRemark: '',
      lifecycleStatus: 'Active',
      storyId: '',
      preconditions: '',
      steps: [{ id: uid(), action: '', expected: '' }],
      testData: '',
      expectedResult: '',
      actualResult: '',
      status: 'Not Executed',
      comments: '',
      sprint: settings.activeSprint || settings.sprints[settings.sprints.length - 1] || '',
      suiteIds: [],
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'steps' })

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.reset({
        title: editing.title,
        module: editing.module,
        category: editing.category ?? settings.categories[0] ?? '',
        priority: editing.priority,
        executionType: editing.executionType,
        automationRemark: editing.automationRemark ?? '',
        lifecycleStatus: editing.lifecycleStatus,
        storyId: editing.storyId ?? '',
        preconditions: editing.preconditions,
        steps: editing.steps.length > 0 ? editing.steps : [{ id: uid(), action: '', expected: '' }],
        testData: editing.testData,
        expectedResult: editing.expectedResult,
        actualResult: editing.actualResult,
        status: editing.status,
        comments: editing.comments,
        sprint: editing.sprint,
        suiteIds: editing.suiteIds,
      })
    } else {
      form.reset({
        title: '',
        module: defaultModule ?? settings.modules[0] ?? 'General',
        category: settings.categories[0] ?? '',
        priority: 'Medium',
        executionType: 'Manual',
        automationRemark: '',
        lifecycleStatus: 'Active',
        storyId: '',
        preconditions: '',
        steps: [{ id: uid(), action: '', expected: '' }],
        testData: '',
        expectedResult: '',
        actualResult: '',
        status: 'Not Executed',
        comments: '',
        sprint: settings.activeSprint || settings.sprints[settings.sprints.length - 1] || '',
        suiteIds: [],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  function onSubmit(values: CaseFormValues) {
    const cleaned = {
      ...values,
      category: values.category.trim() || undefined,
      storyId: values.storyId.trim() || undefined,
      steps: values.steps.filter((s) => s.action.trim() !== ''),
      bugIds: editing?.bugIds ?? [],
      automationRemark:
        values.executionType === 'Manual' ? values.automationRemark.trim() || undefined : undefined,
    }
    if (editing) {
      updateCase(editing.id, { ...cleaned, version: editing.version + 1 })
      toast.success('Test case updated', `${editing.id} saved as v${editing.version + 1}.`)
    } else {
      const c = addCase(cleaned)
      toast.success('Test case created', `${c.id} added to the library.`)
    }
    onOpenChange(false)
  }

  const suiteIds = form.watch('suiteIds')

  const detailsFields = (
    <>
      <div className="grid gap-2">
            <Label htmlFor="tc-title">Title</Label>
            <Input
              id="tc-title"
              autoFocus
              placeholder="What is being verified?"
              {...form.register('title', { required: true })}
            />
            {form.formState.errors.title && <p className="text-xs text-destructive">Title is required.</p>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
            <div className="grid gap-2">
              <Label>Module</Label>
              <Select value={form.watch('module')} onValueChange={(v) => form.setValue('module', v)}>
                <SelectTrigger title={form.watch('module')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {moduleOptions.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
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
              <Label>Execution</Label>
              <Select
                value={form.watch('executionType')}
                onValueChange={(v) => form.setValue('executionType', v as ExecutionType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXECUTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as CaseStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CASE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sprint</Label>
              <Select value={form.watch('sprint')} onValueChange={(v) => form.setValue('sprint', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {settings.sprints.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={form.watch('category')} onValueChange={(v) => form.setValue('category', v)}>
                <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Lifecycle</Label>
              <Select
                value={form.watch('lifecycleStatus')}
                onValueChange={(v) => form.setValue('lifecycleStatus', v as LifecycleStatus)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tc-story">Jira Story</Label>
              <Input id="tc-story" placeholder="e.g. SV1-11466" {...form.register('storyId')} />
            </div>
          </div>

          {form.watch('executionType') === 'Manual' && (
            <div className="grid gap-2">
              <Label htmlFor="tc-remark">Remark — why is this manual?</Label>
              <Input
                id="tc-remark"
                placeholder="e.g. requires a physical device, destructive flow kept manual on purpose…"
                {...form.register('automationRemark')}
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="tc-pre">Preconditions</Label>
            <Textarea id="tc-pre" rows={2} placeholder="State required before execution" {...form.register('preconditions')} />
          </div>

          <div className="grid gap-2">
            <Label>Test Steps</Label>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-start gap-2">
                  <span className="mt-2.5 text-faint">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="mt-2 text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                  <div className="flex-1 grid gap-1.5 sm:grid-cols-2">
                    <Input placeholder="Action" {...form.register(`steps.${i}.action`)} />
                    <Input placeholder="Expected (optional)" {...form.register(`steps.${i}.expected`)} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 text-muted-foreground"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => append({ id: uid(), action: '', expected: '' })}
            >
              <Plus /> Add Step
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="tc-data">Test Data</Label>
              <Textarea id="tc-data" rows={2} placeholder="Inputs, accounts, payloads…" {...form.register('testData')} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tc-expected">Expected Result</Label>
              <Textarea id="tc-expected" rows={2} placeholder="Overall expected outcome" {...form.register('expectedResult')} />
            </div>
          </div>

          {editing && (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="tc-actual">Actual Result</Label>
                <Textarea id="tc-actual" rows={2} {...form.register('actualResult')} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tc-comments">Comments</Label>
                <Textarea id="tc-comments" rows={2} {...form.register('comments')} />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Suites</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border p-3">
              {suites.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={suiteIds.includes(s.id)}
                    onCheckedChange={(checked) => {
                      form.setValue(
                        'suiteIds',
                        checked ? [...suiteIds, s.id] : suiteIds.filter((id) => id !== s.id),
                      )
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
    </>
  )

  const historyPanel = (
    <div className="max-h-96 overflow-y-auto rounded-md border divide-y">
      {history.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          No executions recorded for this case yet.
        </p>
      ) : (
        history.map((h, i) => (
          <div key={`${h.runId}-${i}`} className="px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={h.status} />
              <span className="font-medium">{h.runId}</span>
              <span className="text-xs text-muted-foreground">
                {h.tester} · Build {h.build} · {h.environment}
              </span>
              <span className="ml-auto text-xs text-faint whitespace-nowrap">
                {h.executedAt ? formatDateTime(h.executedAt) : '—'}
                {h.durationSec != null && ` · ${formatDuration(h.durationSec)}`}
              </span>
            </div>
            {h.actualResult && <p className="mt-1 text-xs text-muted-foreground">{h.actualResult}</p>}
            {h.bugId && <p className="mt-1 text-xs text-status-critical">Bug: {h.bugId}</p>}
          </div>
        ))
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit Test Case — ${editing.id} (v${editing.version})` : 'New Test Case'}
          </DialogTitle>
          <DialogDescription>
            {editing ? 'Update the definition of this test case. Saving increments its version.' : 'Define the test case. You can assign it to suites below.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          {editing ? (
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">
                  <HistoryIcon className="h-3.5 w-3.5 mr-1.5" /> History ({history.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="grid gap-4">
                {detailsFields}
              </TabsContent>
              <TabsContent value="history">{historyPanel}</TabsContent>
            </Tabs>
          ) : (
            detailsFields
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? 'Save Changes' : 'Create Test Case'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
