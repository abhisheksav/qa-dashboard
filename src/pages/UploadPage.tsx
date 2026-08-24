import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, FileSpreadsheet, Trash2, Upload, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PriorityBadge } from '@/components/shared/badges'
import { useDataStore } from '@/store/useDataStore'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import { downloadImportTemplate, parseImportFile, type ImportedCase } from '@/lib/importExport'
import { toast } from '@/components/ui/toaster'

const FROM_FILE = '__file__'

export function UploadPage() {
  const { settings, importCases } = useDataStore()
  const user = useAuthStore((s) => s.user)
  const uploadedBy = user?.name ?? settings.currentTester

  const [assignModule, setAssignModule] = useState<string>(FROM_FILE)
  const [parsed, setParsed] = useState<ImportedCase[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [submittedCount, setSubmittedCount] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The module dropdown re-tags the parsed cases live: picking a module
  // assigns it to every case and keeps the sheet's own Module value as the
  // sub-module; "Use the sheet's Module column" shows the file as-is.
  const preview = useMemo(() => {
    if (!parsed) return null
    if (assignModule === FROM_FILE) return parsed
    return parsed.map((c) => ({
      ...c,
      module: assignModule,
      subModule:
        c.subModule ?? (c.module !== assignModule && c.module !== 'General' ? c.module : undefined),
    }))
  }, [parsed, assignModule])

  async function handleFile(file: File) {
    try {
      const { cases, sheetTitle } = await parseImportFile(file)
      if (cases.length === 0) {
        toast.error('Nothing to upload', 'No rows with a Title column were found in the file.')
        return
      }
      setFileName(file.name)
      // Folder name in the review queue: the sheet's banner title when it has
      // one, otherwise the file name without its extension.
      setUploadName(sheetTitle ?? file.name.replace(/\.[^.]+$/, ''))
      setParsed(cases)
      setSubmittedCount(null)
    } catch (err) {
      toast.error('Upload failed', err instanceof Error ? err.message : 'Could not parse the file.')
    }
  }

  function submit() {
    if (!preview || preview.length === 0) return
    const n = importCases(preview, {
      uploadedBy,
      uploadName: uploadName.trim() || fileName.replace(/\.[^.]+$/, ''),
    })
    setParsed(null)
    setFileName('')
    setUploadName('')
    setSubmittedCount(n)
    toast.success('Sent for review', `${n} test case${n === 1 ? '' : 's'} added to the review queue.`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload Test Cases</h1>
        <p className="text-sm text-muted-foreground">
          Upload the Excel/CSV sheet you maintain — the cases go to Review &amp; Approval before joining the library.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            After parsing you can pick the module and the review-queue folder name below.
          </p>
          <Button variant="outline" onClick={downloadImportTemplate}>
            <FileSpreadsheet /> Download Template
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls,.xlsm,.xlsb,.ods"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handleFile(file)
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) void handleFile(file)
          }}
          className={cn(
            'w-full rounded-lg border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50',
          )}
        >
          <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop your Excel / CSV here, or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            .xlsx, .xls, .xlsm, .csv or .tsv — a workbook with one tab per module imports every tab.
            Only a Title (or Test Scenario) column is required. Uploading as {uploadedBy}.
          </p>
        </button>
      </Card>

      {submittedCount !== null && (
        <Card className="p-4 flex flex-wrap items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success-text shrink-0" />
          <p className="text-sm flex-1">
            {submittedCount} test case{submittedCount === 1 ? '' : 's'} submitted and waiting for review.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/review">
              <ClipboardCheck /> Open Review &amp; Approval
            </Link>
          </Button>
        </Card>
      )}

      {preview && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">
                {preview.length} case{preview.length === 1 ? '' : 's'} parsed from {fileName}
              </h2>
              <p className="text-xs text-muted-foreground">
                Check the rows below, remove any strays, then submit for review.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setParsed(null)}>Cancel</Button>
              <Button onClick={submit}>
                <Upload /> Submit {preview.length} for Review
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 content-start">
              <Label>Module</Label>
              <Select value={assignModule} onValueChange={setAssignModule}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={FROM_FILE}>Use the sheet's Module column</SelectItem>
                  {settings.modules.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Picking a module tags every case with it; the sheet's own Module value is kept as the sub-module.
              </span>
            </div>
            <div className="grid gap-1.5 content-start">
              <Label htmlFor="upload-name">Section / folder name in the review queue</Label>
              <Input
                id="upload-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. Corporate Events Calendar"
              />
              <span className="text-xs text-muted-foreground">
                Pre-filled from the sheet's title row; the reviewer sees the cases grouped under this name.
              </span>
            </div>
          </div>
          <div className="rounded-md border max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Title</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="block max-w-[26rem] truncate" title={c.title}>{c.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.module}</Badge>
                      {c.subModule && (
                        <span className="block text-[11px] text-muted-foreground mt-0.5">{c.subModule}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.caseType ?? '—'}</TableCell>
                    <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                    <TableCell className="text-muted-foreground">{c.steps.length}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        aria-label={`Remove ${c.title}`}
                        onClick={() => setParsed((rows) => rows && rows.filter((_, j) => j !== i))}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
