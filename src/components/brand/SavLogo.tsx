import { cn } from '@/lib/utils'

// Recreation of the Sav brand mark: black squircle with a white "S" swirl.
export function SavMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('shrink-0', className)} aria-hidden="true">
      <rect width="48" height="48" rx="14" className="fill-[#0b0b0b] dark:stroke-white/15" strokeWidth="1" />
      <path
        d="M 33.5 16 C 33.5 12.2 28.8 10.6 24.2 10.6 C 19.2 10.6 15.1 12.8 15.1 16.6 C 15.1 24.4 33.1 20.4 33.1 28.4 C 33.1 32.4 28.6 34.6 23.8 34.6 C 19.2 34.6 14.5 32.8 14.5 29"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        transform="rotate(-12 24 24)"
      />
    </svg>
  )
}

export function SavLogo({ subtitle = 'QA Test Execution' }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <SavMark className="h-8 w-8" />
      <div className="leading-tight min-w-0">
        <p className="font-bold text-[17px] tracking-tight leading-none">Sav</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}
