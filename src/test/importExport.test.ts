import { describe, expect, it } from 'vitest'
import { parseImportFile } from '@/lib/importExport'

function csvFile(text: string, name = 'cases.csv') {
  return new File([text], name, { type: 'text/csv' })
}

async function xlsxFile(sheets: Record<string, Record<string, unknown>[]>, name = 'cases.xlsx') {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], name)
}

describe('parseImportFile', () => {
  it('maps common manual-QA sheet columns', async () => {
    const csv = [
      '"S. No","Test Scenario","Test Case Description","Pre-requisite","Steps to Execute","Input Data","Expected Output","Actual Output","Pass/Fail","Remarks","Severity"',
      '1,"Onboarding OTP","User receives OTP on valid mobile","App installed","Step 1: Enter mobile number\nStep 2: Tap Get OTP -> OTP screen opens","9876543210","OTP arrives within 30s","","Pass","Works on Android","P1"',
    ].join('\n')
    const { cases } = await parseImportFile(csvFile(csv), { assignModule: 'Login / Signup / Onboarding' })
    expect(cases).toHaveLength(1)
    const c = cases[0]
    expect(c.title).toBe('User receives OTP on valid mobile')
    expect(c.module).toBe('Login / Signup / Onboarding')
    expect(c.priority).toBe('High')
    expect(c.preconditions).toBe('App installed')
    expect(c.steps).toHaveLength(2)
    expect(c.steps[0].action).toBe('Enter mobile number')
    expect(c.steps[1].action).toBe('Tap Get OTP')
    expect(c.steps[1].expected).toBe('OTP screen opens')
    expect(c.testData).toBe('9876543210')
    expect(c.expectedResult).toBe('OTP arrives within 30s')
    expect(c.status).toBe('Passed')
    expect(c.comments).toContain('Scenario: Onboarding OTP')
    expect(c.comments).toContain('Works on Android')
    expect(c.reviewStatus).toBe('Pending')
  })

  it('keeps "Remarks" mapped to comments and only picks up a dedicated automation-remark column', async () => {
    const csv = [
      'Title,Remarks,Automation Remark,Execution',
      '"Manual case","General QA note","Requires a physical device",Manual',
      '"Auto case","Another note","Should be ignored",Automated',
    ].join('\n')
    const { cases } = await parseImportFile(csvFile(csv))
    expect(cases[0].comments).toBe('General QA note')
    expect(cases[0].executionType).toBe('Manual')
    expect(cases[0].automationRemark).toBe('Requires a physical device')
    expect(cases[1].comments).toBe('Another note')
    expect(cases[1].executionType).toBe('Automated')
    expect(cases[1].automationRemark).toBeUndefined()
  })

  it('parses Category/Lifecycle/Story without colliding with Type or Remarks', async () => {
    const csv = [
      'Title,Type,Category,Lifecycle,Story,Remarks',
      '"API check","Functional","API","Archived","SV1-9001","General QA note"',
      '"UI check","UI","Device","","",""',
    ].join('\n')
    const { cases } = await parseImportFile(csvFile(csv))
    expect(cases[0].caseType).toBe('Functional')
    expect(cases[0].category).toBe('API')
    expect(cases[0].lifecycleStatus).toBe('Archived')
    expect(cases[0].storyId).toBe('SV1-9001')
    expect(cases[0].comments).toBe('General QA note')
    expect(cases[0].version).toBe(1)

    expect(cases[1].category).toBe('Device')
    // No Lifecycle value in the sheet defaults to Active.
    expect(cases[1].lifecycleStatus).toBe('Active')
    expect(cases[1].storyId).toBeUndefined()
  })

  it('uses the Test Scenario column as title when there is no title column', async () => {
    const csv = ['"Test Scenario","Expected Result","Status"', '"Card PIN reset","PIN reset succeeds","FAIL"'].join('\n')
    const { cases } = await parseImportFile(csvFile(csv))
    expect(cases).toHaveLength(1)
    expect(cases[0].title).toBe('Card PIN reset')
    expect(cases[0].status).toBe('Failed')
    expect(cases[0].module).toBe('General')
  })

  it('normalizes P0-P3 tags and lenient status values', async () => {
    const csv = [
      'Title,Priority,Status',
      'A,P0,Not Run',
      'B,p3,Blocked',
      'C,Major,N/A',
    ].join('\n')
    const { cases } = await parseImportFile(csvFile(csv))
    expect(cases.map((r) => r.priority)).toEqual(['Critical', 'Low', 'High'])
    expect(cases.map((r) => r.status)).toEqual(['Not Executed', 'Blocked', 'Skipped'])
  })

  it('does not strip leading digits that are part of the step text', async () => {
    const csv = ['Title,Test Steps', '"T","1. Enable 2FA in settings\n2FA prompt appears on login"'].join('\n')
    const { cases } = await parseImportFile(csvFile(csv))
    expect(cases[0].steps.map((s) => s.action)).toEqual(['Enable 2FA in settings', '2FA prompt appears on login'])
  })

  it('imports the team sheet format: banner row, TC ID, Type and Bug columns', async () => {
    const csv = [
      '"Sav Money  •  Corporate Events Calendar — Manual Test Case Suite",,,,,,,,,',
      '"TC ID","Module","Test Scenario","Preconditions","Test Steps","Expected Result","Priority","Type","Status","Bug"',
      '"TC_01","Discover – Entry","Corporate Events section is displayed on the Discover page","User is logged in; corporate events exist","1. Launch the app and log in\n2. Go to the Discover tab\n3. Scroll to the Corporate Events section","A Corporate Events section is visible with a heading","P0","Functional","Pass",""',
      '"TC_14","Event-Type Filter","Filter events by type — all options","Earnings and dividend events both exist","1. Open Event type sheet\n2. Select Earnings only","The list matches the selected type","P0","Functional","Fail","https://savmoney.atlassian.net/browse/SV1-11466"',
    ].join('\n')

    const { cases, sheetTitle } = await parseImportFile(csvFile(csv), { assignModule: 'SAV Wealth' })
    expect(sheetTitle).toBe('Corporate Events Calendar')
    expect(cases).toHaveLength(2)
    expect(cases[0].title).toBe('Corporate Events section is displayed on the Discover page')
    expect(cases[0].module).toBe('SAV Wealth')
    expect(cases[0].subModule).toBe('Discover – Entry')
    expect(cases[0].caseType).toBe('Functional')
    expect(cases[0].priority).toBe('Critical')
    expect(cases[0].steps).toHaveLength(3)
    expect(cases[0].steps[0].action).toBe('Launch the app and log in')
    expect(cases[0].status).toBe('Passed')
    expect(cases[1].status).toBe('Failed')
    expect(cases[1].bugIds).toEqual(['SV1-11466'])

    // Without an assigned module the sheet's Module column is used directly.
    const asIs = await parseImportFile(csvFile(csv))
    expect(asIs.cases[0].module).toBe('Discover – Entry')
    expect(asIs.cases[0].subModule).toBeUndefined()
  })

  it('imports every tab of a workbook, tab name winning as module', async () => {
    const file = await xlsxFile({
      'SAV Card': [{ Title: 'Card activation', Priority: 'P0' }],
      'SAV Gold': [{ Title: 'Gold SIP purchase' }],
    })
    const { cases } = await parseImportFile(file, { assignModule: 'Offboarding' })
    expect(cases.map((r) => r.module)).toEqual(['SAV Card', 'SAV Gold'])
    expect(cases[0].priority).toBe('Critical')
  })

  it('prefers the chosen module over the tab name for single-sheet files', async () => {
    const single = await xlsxFile({ 'SAV Wealth': [{ Title: 'KYC for wealth' }] })
    const withChoice = await parseImportFile(single, { assignModule: 'SAV Card' })
    expect(withChoice.cases[0].module).toBe('SAV Card')

    const noChoice = await parseImportFile(await xlsxFile({ 'SAV Wealth': [{ Title: 'KYC for wealth' }] }))
    expect(noChoice.cases[0].module).toBe('SAV Wealth')

    const genericTab = await parseImportFile(await xlsxFile({ Sheet1: [{ Title: 'KYC for wealth' }] }))
    expect(genericTab.cases[0].module).toBe('General')
  })
})
