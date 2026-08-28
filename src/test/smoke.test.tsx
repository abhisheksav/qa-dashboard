import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '@/App'
import { useAuthStore } from '@/store/useAuthStore'

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('route smoke tests', () => {
  it('renders the sprint dashboard with KPIs and executions', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'QA Test Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Total Test Cases')).toBeInTheDocument()
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
    expect(screen.getByText('Test Executions')).toBeInTheDocument()
    expect(screen.getAllByText(/RUN-\d+/).length).toBeGreaterThan(0)
  })

  it('breaks cases down by derived test type', () => {
    renderAt('/')
    expect(screen.getByText('Test Cases by Type')).toBeInTheDocument()
    // Types are derived from executionType + category, not stored.
    expect(screen.getAllByText('Automated API').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Automated UI').length).toBeGreaterThan(0)
  })

  it('lists every sprint in the All Test Cases section and filters it', () => {
    renderAt('/')
    expect(screen.getByText('All Test Cases')).toBeInTheDocument()
    expect(screen.getByText('TC-001')).toBeInTheDocument()
    expect(screen.getByText('TC-025')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search test cases'), {
      target: { value: 'TC-025' },
    })
    expect(screen.getByText('TC-025')).toBeInTheDocument()
    expect(screen.queryByText('TC-001')).not.toBeInTheDocument()
  })

  it('shows why a manual case has not been automated in the Remark column', () => {
    renderAt('/cases')
    expect(screen.getByText('Destructive flow — kept manual on purpose to avoid deleting test accounts in CI.')).toBeInTheDocument()
  })

  it('renders test suites with seed suites', () => {
    renderAt('/suites')
    expect(screen.getByRole('heading', { name: 'Test Suites' })).toBeInTheDocument()
    expect(screen.getByText('Smoke')).toBeInTheDocument()
    expect(screen.getByText('Regression')).toBeInTheDocument()
  })

  it('renders the test case table', () => {
    renderAt('/cases')
    expect(screen.getByRole('heading', { name: 'Test Cases' })).toBeInTheDocument()
    expect(screen.getByText('TC-001')).toBeInTheDocument()
  })

  it('applies status filter from URL params', () => {
    renderAt('/cases?status=Failed')
    expect(screen.getByRole('heading', { name: 'Test Cases' })).toBeInTheDocument()
    expect(screen.queryByText('TC-001')).not.toBeInTheDocument()
  })

  it('hides archived cases by default and shows them when the Lifecycle filter is set to Archived', () => {
    // TC-021 is seeded as Archived.
    renderAt('/cases')
    expect(screen.queryByText('TC-021')).not.toBeInTheDocument()
    renderAt('/cases?lifecycle=Archived')
    expect(screen.getByText('TC-021')).toBeInTheDocument()
  })

  it('opens the edit dialog with version and a History tab', () => {
    renderAt('/cases')
    fireEvent.click(screen.getByText('TC-001'))
    expect(screen.getByRole('heading', { name: /Edit Test Case — TC-001 \(v1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument()
  })

  it('runs a hand-picked case ad hoc from the Test Cases table', () => {
    renderAt('/cases')
    const rows = screen.getAllByRole('row').filter((r) => within(r).queryByText('TC-001'))
    fireEvent.click(within(rows[0]).getByRole('checkbox', { name: 'Select row' }))
    fireEvent.click(screen.getByRole('button', { name: /Execute Selected/ }))
    expect(screen.getByRole('heading', { name: /Execute TC-001/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Start Execution/ }))
    expect(screen.getByText('Execution Sequence')).toBeInTheDocument()
  })

  it('renders the upload page', () => {
    renderAt('/upload')
    expect(screen.getByRole('heading', { name: 'Upload Test Cases' })).toBeInTheDocument()
    expect(screen.getByText(/Drop your Excel \/ CSV here/)).toBeInTheDocument()
  })

  it('renders the review page with decision tabs', () => {
    renderAt('/review')
    expect(screen.getByRole('heading', { name: 'Review & Approval' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Pending/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Approved/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Rejected/ })).toBeInTheDocument()
  })

  it('renders run history', () => {
    renderAt('/runs')
    expect(screen.getByRole('heading', { name: 'Test Runs' })).toBeInTheDocument()
    expect(screen.getByText('RUN-001')).toBeInTheDocument()
  })

  it('opens the Playwright import dialog from Test Runs, and via the ?import=playwright deep link', () => {
    renderAt('/runs')
    fireEvent.click(screen.getByRole('button', { name: /Import Playwright Results/ }))
    expect(screen.getByRole('heading', { name: /Import Playwright Results/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    renderAt('/runs?import=playwright')
    expect(screen.getByRole('heading', { name: /Import Playwright Results/ })).toBeInTheDocument()
  })

  it('renders run detail with per-case results', () => {
    renderAt('/runs/RUN-001')
    expect(screen.getByRole('heading', { name: 'RUN-001' })).toBeInTheDocument()
    expect(screen.getByText('TC-026')).toBeInTheDocument()
  })

  it('renders the execution runner for an in-progress run', () => {
    renderAt('/execute/RUN-008')
    expect(screen.getByText('Execution Sequence')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pass/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fail/ })).toBeInTheDocument()
  })

  it('renders the bug tracker with seed bugs', () => {
    renderAt('/bugs')
    expect(screen.getByRole('heading', { name: 'Bug Tracker' })).toBeInTheDocument()
    expect(screen.getByText('BUG-001')).toBeInTheDocument()
  })

  it('renders reports (lazy route) with all chart cards', async () => {
    renderAt('/reports')
    expect(await screen.findByText('Pass vs Fail', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Daily Execution Trend')).toBeInTheDocument()
    expect(screen.getByText('Module-wise Failures')).toBeInTheDocument()
    expect(screen.getByText('Bug Severity Distribution')).toBeInTheDocument()
    expect(screen.getByText('Test Execution Progress')).toBeInTheDocument()
    expect(screen.getByText('Suite Progress')).toBeInTheDocument()
  })

  it('renders settings with integrations', async () => {
    renderAt('/settings')
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })
})

describe('execution flow', () => {
  it('records a Pass result on an unexecuted case', () => {
    renderAt('/execute/RUN-008')
    expect(screen.getByText(/5\/8 executed/)).toBeInTheDocument()
    // jump to a not-yet-executed case in the sequence
    fireEvent.click(screen.getByRole('button', { name: /TC-025/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Pass$/ }))
    expect(screen.getByText(/6\/8 executed/)).toBeInTheDocument()
  })

  it('opens the bug capture form when Fail is clicked and links the bug', () => {
    // store is shared across tests in this file: TC-025 was executed above (6/8)
    renderAt('/execute/RUN-008')
    fireEvent.click(screen.getByRole('button', { name: /TC-026/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Fail$/ }))
    expect(screen.getByText(/Log Bug for TC-026/)).toBeInTheDocument()
    expect(screen.getByLabelText('Bug Summary')).toBeInTheDocument()
    expect(screen.getByLabelText('Bug Description')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Log Bug & Mark Failed/ }))
    expect(screen.getByText(/7\/8 executed/)).toBeInTheDocument()
  })
})

describe('authentication', () => {
  it('redirects to login when signed out and rejects bad credentials', async () => {
    useAuthStore.getState().logout()
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Sign in to Sav' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'abhishek@sav.money' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/ }))
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })

  it('signs in with the QA credentials and reaches the dashboard', async () => {
    useAuthStore.getState().logout()
    renderAt('/')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'abhishek@sav.money' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Sav@12345' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/ }))
    expect(await screen.findByText('Total Test Cases')).toBeInTheDocument()
    expect(screen.getAllByText('Abhishek').length).toBeGreaterThan(0)
  })
})
