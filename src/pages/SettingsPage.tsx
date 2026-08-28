import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  X,
  RotateCcw,
  Database,
  Plug,
  User,
  ListChecks,
  ExternalLink,
  Bot,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDataStore } from '@/store/useDataStore'
import { toast } from '@/components/ui/toaster'
import type { AppSettings, IntegrationId } from '@/types'

const integrationMeta: Record<
  IntegrationId,
  { name: string; description: string; note?: string; fields: { key: string; label: string; secret?: boolean }[] }
> = {
  jira: {
    name: 'Jira',
    description: 'Push failed test cases as Jira issues and sync bug status.',
    fields: [
      { key: 'baseUrl', label: 'Base URL' },
      { key: 'projectKey', label: 'Project Key' },
      { key: 'email', label: 'Account Email' },
      { key: 'apiToken', label: 'API Token', secret: true },
    ],
  },
  testrail: {
    name: 'TestRail',
    description: 'Import suites and publish run results to TestRail.',
    fields: [
      { key: 'baseUrl', label: 'Instance URL' },
      { key: 'projectId', label: 'Project ID' },
      { key: 'apiKey', label: 'API Key', secret: true },
    ],
  },
  zephyr: {
    name: 'Zephyr',
    description: 'Sync test cycles and executions with Zephyr Scale.',
    fields: [
      { key: 'baseUrl', label: 'Base URL' },
      { key: 'apiToken', label: 'API Token', secret: true },
    ],
  },
  playwright: {
    name: 'Playwright',
    description: 'Ingest automated Playwright results into run history.',
    note:
      "Tag test titles with the case ID — test('TC-025: GET /products returns 200', ...) — then run " +
      "playwright test --reporter=json > results.json and import that file from Test Runs. Allure " +
      "(allure-playwright) stays the human-facing HTML report on the CI side; this JSON file is what " +
      'feeds this dashboard.',
    fields: [
      { key: 'reportPath', label: 'JSON Report Path / URL' },
      { key: 'resultsWebhook', label: 'Results Webhook' },
    ],
  },
  'github-actions': {
    name: 'GitHub Actions',
    description: 'Trigger suite runs from CI and report status back to PRs.',
    fields: [
      { key: 'repo', label: 'Repository (owner/name)' },
      { key: 'workflow', label: 'Workflow File' },
      { key: 'token', label: 'Access Token', secret: true },
    ],
  },
  jenkins: {
    name: 'Jenkins',
    description: 'Kick off Jenkins jobs per suite and pull build numbers.',
    fields: [
      { key: 'baseUrl', label: 'Jenkins URL' },
      { key: 'jobName', label: 'Job Name' },
      { key: 'apiToken', label: 'API Token', secret: true },
    ],
  },
  browserstack: {
    name: 'BrowserStack',
    description: 'Attach BrowserStack session links to executions.',
    fields: [
      { key: 'username', label: 'Username' },
      { key: 'accessKey', label: 'Access Key', secret: true },
    ],
  },
  slack: {
    name: 'Slack',
    description: 'Post run summaries and new bugs to a Slack channel.',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', secret: true },
      { key: 'channel', label: 'Channel' },
    ],
  },
}

function ListEditor({
  title,
  items,
  onAdd,
  onRemove,
  minItems = 1,
}: {
  title: string
  items: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  minItems?: number
}) {
  const [value, setValue] = useState('')
  return (
    <div className="grid gap-2">
      <Label>{title}</Label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1 pr-1">
            {item}
            <button
              className="rounded-sm p-0.5 hover:bg-foreground/10 cursor-pointer disabled:opacity-40"
              onClick={() => onRemove(item)}
              disabled={items.length <= minItems}
              aria-label={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const v = value.trim()
          if (!v || items.includes(v)) return
          onAdd(v)
          setValue('')
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Add ${title.toLowerCase().replace(/s$/, '')}…`}
          className="max-w-56 h-8"
        />
        <Button type="submit" variant="outline" size="sm">
          <Plus /> Add
        </Button>
      </form>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { settings, updateSettings, integrations, updateIntegration, resetToSeed } = useDataStore()
  const [resetOpen, setResetOpen] = useState(false)
  const [configuring, setConfiguring] = useState<IntegrationId | null>(null)
  const [draftSettings, setDraftSettings] = useState<Record<string, string>>({})

  function listActions(
    key: keyof Pick<AppSettings, 'testers' | 'builds' | 'environments' | 'sprints' | 'modules' | 'categories'>,
  ) {
    return {
      onAdd: (v: string) => updateSettings({ [key]: [...settings[key], v] }),
      onRemove: (v: string) => updateSettings({ [key]: settings[key].filter((x) => x !== v) }),
    }
  }

  const configMeta = configuring ? integrationMeta[configuring] : null

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace, execution defaults, and integrations</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><User className="h-4 w-4 mr-1.5" /> General</TabsTrigger>
          <TabsTrigger value="lists"><ListChecks className="h-4 w-4 mr-1.5" /> Lists</TabsTrigger>
          <TabsTrigger value="integrations"><Plug className="h-4 w-4 mr-1.5" /> Integrations</TabsTrigger>
          <TabsTrigger value="data"><Database className="h-4 w-4 mr-1.5" /> Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execution Defaults</CardTitle>
              <CardDescription>Pre-filled when starting a new test run.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Current Tester</Label>
                <Select value={settings.currentTester} onValueChange={(v) => updateSettings({ currentTester: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.testers.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Default Build</Label>
                <Select value={settings.defaultBuild} onValueChange={(v) => updateSettings({ defaultBuild: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.builds.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Default Environment</Label>
                <Select value={settings.defaultEnvironment} onValueChange={(v) => updateSettings({ defaultEnvironment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.environments.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lists">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Lists</CardTitle>
              <CardDescription>
                Values offered in dropdowns across the app — testers, builds, environments, sprints, and
                modules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ListEditor title="Testers" items={settings.testers} {...listActions('testers')} />
              <Separator />
              <ListEditor title="Builds" items={settings.builds} {...listActions('builds')} />
              <Separator />
              <ListEditor title="Environments" items={settings.environments} {...listActions('environments')} />
              <Separator />
              <ListEditor title="Sprints" items={settings.sprints} {...listActions('sprints')} />
              <div className="grid gap-2 max-w-sm">
                <Label htmlFor="active-sprint">Active sprint</Label>
                <Select
                  value={settings.activeSprint || undefined}
                  onValueChange={(v) => updateSettings({ activeSprint: v })}
                >
                  <SelectTrigger id="active-sprint">
                    <SelectValue placeholder="Select the sprint in progress" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.sprints.map((sp) => (
                      <SelectItem key={sp} value={sp}>
                        {sp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The sprint currently in flight. The dashboard opens on it and new test cases and
                  runs default to it. Set it explicitly because the list holds future sprints too,
                  so the last entry is not the active one.
                </p>
              </div>
              <Separator />
              <ListEditor title="Modules" items={settings.modules} {...listActions('modules')} />
              <div className="grid gap-2">
                <Label>Product Owners</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Who signs off test cases for each module. Ownership is per module rather than per
                  case, so changing an owner here updates every case in that module at once. Leave a
                  module blank and its cases can be approved by anyone.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {settings.modules.map((m) => (
                    <div key={m} className="flex items-center gap-2">
                      <span className="text-sm truncate w-40 shrink-0" title={m}>
                        {m}
                      </span>
                      <Input
                        aria-label={`Product Owner for ${m}`}
                        placeholder="Anyone can approve"
                        value={settings.productOwners?.[m] ?? ''}
                        onChange={(e) => {
                          const next = { ...(settings.productOwners ?? {}) }
                          const name = e.target.value
                          // Drop the key rather than storing an empty string, so
                          // "anyone can approve" is one state instead of two.
                          if (name.trim()) next[m] = name
                          else delete next[m]
                          updateSettings({ productOwners: next })
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <ListEditor title="Categories" items={settings.categories} {...listActions('categories')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="grid gap-3 sm:grid-cols-2">
            {integrations.map((integration) => {
              const meta = integrationMeta[integration.id]
              return (
                <Card key={integration.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{meta.name}</h3>
                    <Badge variant={integration.enabled ? 'default' : 'muted'} className="ml-auto">
                      {integration.enabled ? 'Enabled' : 'Not connected'}
                    </Badge>
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={(enabled) => {
                        updateIntegration(integration.id, { enabled })
                        toast.info(
                          `${meta.name} ${enabled ? 'enabled' : 'disabled'}`,
                          enabled
                            ? 'Connector activates once the backend sync service is deployed.'
                            : undefined,
                        )
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground flex-1">{meta.description}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        setConfiguring(integration.id)
                        setDraftSettings({ ...integration.settings })
                      }}
                    >
                      <ExternalLink /> Configure
                    </Button>
                    {integration.id === 'playwright' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() => navigate('/runs?import=playwright')}
                      >
                        <Bot /> Import Results
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-faint">
            Integration credentials are stored with your workspace data. Sync logic ships with the
            backend service — the connector contract is defined in the persistence layer so adapters
            plug in without UI changes.
          </p>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data & Backend</CardTitle>
              <CardDescription>Where your workspace data lives.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Local storage (this browser)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All data persists in this browser only. Clearing site data or switching
                    browsers starts a fresh workspace — export from Test Cases to keep a copy.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 p-4">
                <RotateCcw className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Reset workspace</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Restore the demo dataset. All test cases, suites, runs, and bugs you created are
                    replaced.
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integration config dialog */}
      <Dialog open={configuring !== null} onOpenChange={(o) => !o && setConfiguring(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {configMeta?.name}</DialogTitle>
            <DialogDescription>{configMeta?.description}</DialogDescription>
          </DialogHeader>
          {configMeta?.note && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {configMeta.note}
            </p>
          )}
          <div className="grid gap-3">
            {configMeta?.fields.map((f) => (
              <div key={f.key} className="grid gap-2">
                <Label htmlFor={`int-${f.key}`}>{f.label}</Label>
                <Input
                  id={`int-${f.key}`}
                  type={f.secret ? 'password' : 'text'}
                  value={draftSettings[f.key] ?? ''}
                  onChange={(e) => setDraftSettings((d) => ({ ...d, [f.key]: e.target.value }))}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfiguring(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (configuring) {
                  updateIntegration(configuring, { settings: draftSettings })
                  toast.success(`${configMeta?.name} settings saved`)
                }
                setConfiguring(null)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirm */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset workspace to demo data?</DialogTitle>
            <DialogDescription>
              Everything you created or executed is replaced by the seed dataset. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetToSeed()
                setResetOpen(false)
                toast.success('Workspace reset', 'Demo data restored.')
              }}
            >
              <RotateCcw /> Reset Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
