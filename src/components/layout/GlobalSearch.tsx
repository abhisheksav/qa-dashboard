import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Layers, Bug as BugIcon, PlayCircle, Package } from 'lucide-react'
import { useDataStore } from '@/store/useDataStore'
import { cn } from '@/lib/utils'

interface Hit {
  kind: 'case' | 'suite' | 'bug' | 'run' | 'build'
  id: string
  title: string
  subtitle: string
  to: string
}

const kindIcon = {
  case: FileText,
  suite: Layers,
  bug: BugIcon,
  run: PlayCircle,
  build: Package,
}

const kindLabel = {
  case: 'Test Case',
  suite: 'Suite',
  bug: 'Bug',
  run: 'Run',
  build: 'Build',
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { testCases, suites, bugs, runs } = useDataStore()

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const out: Hit[] = []
    for (const c of testCases) {
      if (
        c.id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.module.toLowerCase().includes(q)
      ) {
        out.push({ kind: 'case', id: c.id, title: `${c.id} — ${c.title}`, subtitle: c.module, to: `/cases?q=${encodeURIComponent(c.id)}` })
      }
    }
    for (const s of suites) {
      if (s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) {
        out.push({ kind: 'suite', id: s.id, title: s.name, subtitle: s.id, to: '/suites' })
      }
    }
    for (const b of bugs) {
      if (b.id.toLowerCase().includes(q) || b.summary.toLowerCase().includes(q)) {
        out.push({ kind: 'bug', id: b.id, title: `${b.id} — ${b.summary}`, subtitle: `${b.severity} · ${b.status}`, to: `/bugs?q=${encodeURIComponent(b.id)}` })
      }
    }
    for (const r of runs) {
      if (
        r.id.toLowerCase().includes(q) ||
        r.suiteName.toLowerCase().includes(q) ||
        r.build.toLowerCase().includes(q)
      ) {
        out.push({ kind: 'run', id: r.id, title: `${r.id} — ${r.suiteName}`, subtitle: `Build ${r.build} · ${r.tester}`, to: `/runs/${r.id}` })
      }
    }
    const builds = new Set(runs.map((r) => r.build))
    for (const b of builds) {
      if (b.toLowerCase().includes(q)) {
        out.push({ kind: 'build', id: b, title: `Build ${b}`, subtitle: `${runs.filter((r) => r.build === b).length} runs`, to: `/runs?build=${encodeURIComponent(b)}` })
      }
    }
    return out.slice(0, 10)
  }, [query, testCases, suites, bugs, runs])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function go(hit: Hit) {
    setOpen(false)
    setQuery('')
    navigate(hit.to)
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, hits.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && hits[active]) {
            go(hits[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder="Search cases, suites, bugs, runs, builds…"
        className="h-9 w-full rounded-xl bg-transparent pl-9 pr-16 text-sm placeholder:text-faint transition-colors hover:bg-muted/60 focus:bg-muted/60 focus-visible:outline-none"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
        Ctrl K
      </kbd>
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border bg-popover shadow-lg overflow-hidden menu-pop">
          {hits.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No results for “{query}”</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((hit, i) => {
                const Icon = kindIcon[hit.kind]
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <button
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm cursor-pointer',
                        i === active ? 'bg-muted' : 'hover:bg-muted/60',
                      )}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit)}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">{hit.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-faint shrink-0">
                        {kindLabel[hit.kind]}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
