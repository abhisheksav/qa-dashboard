import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Check, ClipboardCheck, Eye, FolderOpen, RotateCcw, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PriorityBadge, ReviewStatusBadge } from '@/components/shared/badges'
import { useDataStore } from '@/store/useDataStore'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from '@/components/ui/toaster'
import type { TestCase } from '@/types'
import { stickyRightCell, stickyRightHead } from '@/lib/tableSticky'

function when(iso?: string) {
  return iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : '—'
}

const ALL_SECTIONS = '__all_sections'
const ALL_OWNERS = '__all_owners'
const OPEN_TO_ANYONE = '__open_to_anyone'

export function ReviewPage() {
  const { testCases, reviewCases } = useDataStore()
  const currentTester = useDataStore((s) => s.settings.currentTester)
  const productOwners = useDataStore((s) => s.settings.productOwners)
  const user = useAuthStore((s) => s.user)
  const reviewedBy = user?.name ?? currentTester

  // Section is this app's subModule — the importer maps sheet columns named
  // "section"/"subsection"/"screen" onto it, and uploads are organised by it.
  const [section, setSection] = useState(ALL_SECTIONS)
  const [owner, setOwner] = useState(ALL_OWNERS)
  const [selected, setSelected] = useState<string[]>([])
  const [viewing, setViewing] = useState<TestCase | null>(null)
  const [rejecting, setRejecting] = useState<string[]>([])
  const [rejectComment, setRejectComment] = useState('')

  // Every section present across the library, so the dropdown does not empty
  // out as cases move between tabs.
  const sections = useMemo(
    () => [...new Set(testCases.map((c) => c.subModule).filter((x): x is string => !!x))].sort(),
    [testCases],
  )

  // Each module has its own Product Owner, so a case's approver follows from
  // its module rather than being stored on the case.
  const ownerOf = useMemo(
    () => (c: TestCase) => productOwners?.[c.module] ?? '',
    [productOwners],
  )

  // Only owners that actually have cases, plus an open bucket when some module
  // has no PO — a module without an owner is approvable by anyone, so that is a
  // real state to filter on rather than missing data.
  const owners = useMemo(() => {
    const names = new Set<string>()
    let openToAnyone = false
    for (const c of testCases) {
      const po = productOwners?.[c.module]
      if (po) names.add(po)
      else openToAnyone = true
    }
    return { names: [...names].sort(), openToAnyone }
  }, [testCases, productOwners])

  const inSection = useMemo(
    () => (c: TestCase) => section === ALL_SECTIONS || c.subModule === section,
    [section],
  )

  const inOwner = useMemo(
    () => (c: TestCase) => {
      if (owner === ALL_OWNERS) return true
      if (owner === OPEN_TO_ANYONE) return !ownerOf(c)
      return ownerOf(c) === owner
    },
    [owner, ownerOf],
  )

  const pending = useMemo(
    () => testCases.filter((c) => c.reviewStatus === 'Pending' && inSection(c) && inOwner(c)),
    [testCases, inSection, inOwner],
  )
  const approved = useMemo(
    () => testCases.filter((c) => c.reviewStatus === 'Approved' && c.reviewedAt && inSection(c) && inOwner(c)),
    [testCases, inSection, inOwner],
  )
  const rejected = useMemo(
    () => testCases.filter((c) => c.reviewStatus === 'Rejected' && inSection(c) && inOwner(c)),
    [testCases, inSection, inOwner],
  )

  // One folder per upload, named from the sheet's banner/file name; newest first.
  const pendingGroups = useMemo(() => {
    const map = new Map<string, TestCase[]>()
    for (const c of pending) {
      const key = c.uploadName ?? 'Other uploads'
      const group = map.get(key)
      if (group) group.push(c)
      else map.set(key, [c])
    }
    return [...map.entries()].sort(
      (a, b) =>
        Math.max(...b[1].map((c) => Date.parse(c.createdAt))) -
        Math.max(...a[1].map((c) => Date.parse(c.createdAt))),
    )
  }, [pending])

  function approve(ids: string[]) {
    reviewCases(ids, 'Approved', { reviewedBy })
    setSelected((s) => s.filter((id) => !ids.includes(id)))
    toast.success('Approved', `${ids.length} test case${ids.length === 1 ? '' : 's'} added to the library.`)
  }

  function confirmReject() {
    reviewCases(rejecting, 'Rejected', { reviewedBy, comment: rejectComment.trim() })
    setSelected((s) => s.filter((id) => !rejecting.includes(id)))
    toast.success('Rejected', `${rejecting.length} test case${rejecting.length === 1 ? '' : 's'} sent back.`)
    setRejecting([])
    setRejectComment('')
  }

  function resubmit(id: string) {
    reviewCases([id], 'Pending')
    toast.success('Resubmitted', `${id} is back in the review queue.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review &amp; Approval</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length === 0
              ? 'No uploads waiting for review.'
              : `${pending.length} uploaded case${pending.length === 1 ? '' : 's'} waiting for a decision.`}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/upload">
            <Upload /> Upload Test Cases
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
          </TabsList>

          {sections.length > 0 && (
            <div className="flex items-center gap-2">
              <Label htmlFor="section-filter" className="text-sm text-muted-foreground">
                Section
              </Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger id="section-filter" className="w-56">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SECTIONS}>All Sections</SelectItem>
                  {sections.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(owners.names.length > 0 || owners.openToAnyone) && (
            <div className="flex items-center gap-2">
              <Label htmlFor="owner-filter" className="text-sm text-muted-foreground">
                Product Owner
              </Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger id="owner-filter" className="w-52">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OWNERS}>All Product Owners</SelectItem>
                  {owners.names.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                  {owners.openToAnyone && <SelectItem value={OPEN_TO_ANYONE}>Anyone can approve</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}

          {(section !== ALL_SECTIONS || owner !== ALL_OWNERS) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSection(ALL_SECTIONS)
                setOwner(ALL_OWNERS)
              }}
            >
              <X /> Clear
            </Button>
          )}
        </div>

        <TabsContent value="pending">
          <Card className="p-3">
            {selected.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-accent px-3 py-2">
                <span className="text-sm text-accent-foreground font-medium">{selected.length} selected</span>
                <Button size="sm" onClick={() => approve(selected)}>
                  <Check /> Approve Selected
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejecting(selected)}>
                  <X /> Reject Selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
              </div>
            )}
            {pending.length === 0 ? (
              <div className="rounded-md border h-24 flex items-center justify-center text-sm text-muted-foreground">
                Nothing to review — uploaded test cases will appear here, grouped by upload.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingGroups.map(([groupName, cases]) => {
                  const groupIds = cases.map((c) => c.id)
                  const allGroupSelected = groupIds.every((id) => selected.includes(id))
                  return (
                    <div key={groupName} className="rounded-md border">
                      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-semibold">{groupName}</span>
                        <Badge variant="muted">{cases.length}</Badge>
                        <span className="text-xs text-muted-foreground">
                          by {[...new Set(cases.map((c) => c.uploadedBy).filter(Boolean))].join(', ') || '—'}{' '}
                          · {when(cases[0].createdAt)}
                        </span>
                        <span className="ml-auto flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => approve(groupIds)}>
                            <Check /> Approve All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => setRejecting(groupIds)}
                          >
                            <X /> Reject All
                          </Button>
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent bg-card">
                            <TableHead className="w-8">
                              <Checkbox
                                checked={allGroupSelected}
                                onCheckedChange={(v) =>
                                  setSelected((s) =>
                                    v
                                      ? [...new Set([...s, ...groupIds])]
                                      : s.filter((id) => !groupIds.includes(id)),
                                  )
                                }
                                aria-label={`Select all in ${groupName}`}
                              />
                            </TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Module</TableHead>
                            <TableHead>Product Owner</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className={`w-40 ${stickyRightHead()}`}>Decision</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cases.map((c) => (
                            <TableRow key={c.id} className="group/row bg-card hover:bg-muted">
                              <TableCell>
                                <Checkbox
                                  checked={selected.includes(c.id)}
                                  onCheckedChange={(v) =>
                                    setSelected((s) => (v ? [...s, c.id] : s.filter((id) => id !== c.id)))
                                  }
                                  aria-label={`Select ${c.id}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">{c.id}</TableCell>
                              <TableCell>
                                <span className="block max-w-[30rem] truncate" title={c.title}>{c.title}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{c.module}</Badge>
                                {c.subModule && (
                                  <span className="block text-[11px] text-muted-foreground mt-0.5">{c.subModule}</span>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {ownerOf(c) || (
                                  <span className="text-muted-foreground">Anyone</span>
                                )}
                              </TableCell>
                              <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                              <TableCell className={stickyRightCell()}>
                                <span className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    aria-label={`View ${c.id}`}
                                    onClick={() => setViewing(c)}
                                  >
                                    <Eye />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-success-text"
                                    aria-label={`Approve ${c.id}`}
                                    onClick={() => approve([c.id])}
                                  >
                                    <Check />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    aria-label={`Reject ${c.id}`}
                                    onClick={() => setRejecting([c.id])}
                                  >
                                    <X />
                                  </Button>
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card className="p-3">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-card">
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Approved At</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approved.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No reviewed approvals yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    approved.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium whitespace-nowrap">{c.id}</TableCell>
                        <TableCell>
                          <span className="block max-w-[30rem] truncate" title={c.title}>{c.title}</span>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{c.module}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{c.uploadName ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.uploadedBy ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.reviewedBy ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{when(c.reviewedAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`View ${c.id}`}
                            onClick={() => setViewing(c)}
                          >
                            <Eye />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card className="p-3">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-card">
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead>Rejected By</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejected.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No rejected test cases.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rejected.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium whitespace-nowrap">{c.id}</TableCell>
                        <TableCell>
                          <span className="block max-w-[20rem] truncate" title={c.title}>{c.title}</span>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{c.module}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{c.uploadName ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.reviewedBy ?? '—'}</TableCell>
                        <TableCell>
                          <span className="block max-w-[18rem] truncate text-muted-foreground" title={c.reviewComment}>
                            {c.reviewComment || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`View ${c.id}`}
                              onClick={() => setViewing(c)}
                            >
                              <Eye />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => resubmit(c.id)}>
                              <RotateCcw /> Resubmit
                            </Button>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Read-only case detail */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewing.id} — {viewing.title}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <ReviewStatusBadge status={viewing.reviewStatus} />
                  <Badge variant="secondary">{viewing.module}</Badge>
                  {viewing.subModule && <Badge variant="muted">{viewing.subModule}</Badge>}
                  {viewing.caseType && <Badge variant="outline">{viewing.caseType}</Badge>}
                  <PriorityBadge priority={viewing.priority} />
                  {viewing.uploadedBy && <span>Uploaded by {viewing.uploadedBy}</span>}
                  {viewing.uploadName && <span>· {viewing.uploadName}</span>}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm max-h-[55vh] overflow-y-auto pr-1">
                {viewing.preconditions && (
                  <div>
                    <p className="font-medium">Preconditions</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{viewing.preconditions}</p>
                  </div>
                )}
                <div>
                  <p className="font-medium">Test Steps</p>
                  {viewing.steps.length === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                      {viewing.steps.map((s) => (
                        <li key={s.id}>
                          {s.action}
                          {s.expected && <span className="text-faint"> → {s.expected}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {viewing.testData && (
                  <div>
                    <p className="font-medium">Test Data</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{viewing.testData}</p>
                  </div>
                )}
                {viewing.expectedResult && (
                  <div>
                    <p className="font-medium">Expected Result</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{viewing.expectedResult}</p>
                  </div>
                )}
                {viewing.bugIds.length > 0 && (
                  <div>
                    <p className="font-medium">Linked Bugs</p>
                    <p className="text-muted-foreground">{viewing.bugIds.join(', ')}</p>
                  </div>
                )}
                {viewing.reviewStatus === 'Rejected' && viewing.reviewComment && (
                  <div>
                    <p className="font-medium">Rejection Reason</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{viewing.reviewComment}</p>
                  </div>
                )}
              </div>
              {viewing.reviewStatus === 'Pending' && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={() => {
                      setRejecting([viewing.id])
                      setViewing(null)
                    }}
                  >
                    <X /> Reject
                  </Button>
                  <Button
                    onClick={() => {
                      approve([viewing.id])
                      setViewing(null)
                    }}
                  >
                    <Check /> Approve
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject with reason */}
      <Dialog
        open={rejecting.length > 0}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting([])
            setRejectComment('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Reject {rejecting.length === 1 ? rejecting[0] : `${rejecting.length} test cases`}?
            </DialogTitle>
            <DialogDescription>
              Tell the uploader what to fix. Rejected cases stay listed under the Rejected tab and can be resubmitted.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="e.g. Steps are missing expected results; split into one case per scenario."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejecting([])
                setRejectComment('')
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              <ClipboardCheck /> Reject {rejecting.length === 1 ? '' : `${rejecting.length} Cases`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
