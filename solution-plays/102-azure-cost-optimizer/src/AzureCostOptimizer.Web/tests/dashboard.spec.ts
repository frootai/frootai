import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { preparedPrompts } from '../src/preparedAnswers'

test('month-to-date dashboard and cached period interactions remain truthful', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Cost intelligence summary', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cost intelligence summary', exact: true })).toBeVisible()
  await expect(page.locator('.period-control button.active')).toHaveText('This month')
  await expect(page.locator('.primary-metric strong')).toContainText('$')
  await expect(page.getByText(/actual daily totals/)).toBeVisible()
  await expect(page.getByLabel('Spend trend chart').locator('.recharts-surface')).toBeVisible()
  await expect(page.getByLabel('Service allocation chart').locator('.recharts-surface')).toBeVisible()
  await page.getByRole('button', { name: 'Find savings to review', exact: true }).click()
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByRole('columnheader', { name: 'Estimated opportunity' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Confidence' })).toBeVisible()
  } else {
    await expect(page.locator('[data-label="Estimated opportunity"]')).not.toHaveCount(0)
    await expect(page.locator('[data-label="Confidence"]')).not.toHaveCount(0)
  }

  const interactionRequests: string[] = []
  page.on('request', (request) => interactionRequests.push(request.url()))
  await page.getByRole('button', { name: 'Name' }).click()
  await page.getByPlaceholder('Search findings').fill('Cosmos')
  expect(interactionRequests).toEqual([])

  await page.getByRole('button', { name: '7 days' }).click()
  await expect(page.getByRole('heading', { name: 'Azure Cost Optimizer', exact: true })).toBeVisible()
  expect(interactionRequests.every((url) => url.startsWith('http://127.0.0.1:8080/api/v1/'))).toBe(true)
  expect(interactionRequests.some((url) => url.includes('/api/v1/refresh'))).toBe(false)

  const overflow = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)
  expect(consoleErrors).toEqual([])
})

test('streaming ACO workspace renders deterministic artifacts', async ({ page }) => {
  await page.route('**/api/v1/agent/responses/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: [
        'event: meta\ndata: {"conversationId":"conv_0123456789abcdef0123456789abcdef","label":"AI-generated","period":"mtd","reportId":"rpt_test"}\n\n',
        'event: delta\ndata: {"text":"## Answer\\nAzure Container Apps is the largest current service cost.\\n\\n## Evidence\\nEvidence `receipt-test`."}\n\n',
        'event: artifact\ndata: {"kind":"chart","title":"Service cost - This month","chartType":"bar","currency":"USD","series":[{"label":"Azure Container Apps","value":"173.80"}],"evidenceIds":["receipt-test"]}\n\n',
        'event: done\ndata: {"conversationId":"conv_0123456789abcdef0123456789abcdef"}\n\n',
      ].join(''),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Explain the leading service cost and show its evidence.')
  await page.getByRole('button', { name: 'Send question' }).click()
  await expect(page.getByText('Azure Container Apps is the largest current service cost.')).toBeVisible()
  await expect(page.getByText('Service cost - This month', { exact: true })).toBeVisible()
  await expect(page.locator('.agent-artifact .recharts-surface')).toBeVisible()
})

test('core reports expose accessible downloads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Evidence and reports' }).click()
  await expect(page.getByRole('link', { name: /JSON/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /CSV/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /HTML/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /FOCUS/ })).toBeVisible()
})

test('chart values, keyboard focus, and reduced motion remain accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true }).click()

  await page.getByText('View daily spend data', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Daily spend values' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Daily spend values' }).getByRole('cell').first()).toContainText(/^\d{4}-\d{2}-\d{2}$/)
  await page.getByText('View service allocation data', { exact: true }).click()
  await expect(page.getByRole('table', { name: 'Service allocation values' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Service allocation values' }).getByRole('row')).not.toHaveCount(1)

  const refresh = page.getByRole('button', { name: 'Refresh data' })
  await refresh.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(refresh).toBeFocused()
  expect(await refresh.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')
  await page.getByRole('button', { name: 'Evidence and reports' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Evidence and reports' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary', { name: 'Evidence and reports' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Question for ACO' }).fill('A question')
  await page.keyboard.press('Shift+Enter')
  await expect(page.getByRole('textbox', { name: 'Question for ACO' })).toHaveValue('A question\n')

  const animationName = await page.evaluate(() => {
    const cursor = document.createElement('span')
    cursor.className = 'streaming-cursor'
    document.body.append(cursor)
    return getComputedStyle(cursor).animationName
  })
  expect(animationName).toBe('none')
})

for (const status of ['stale', 'degraded', 'partial'] as const) {
  test(`${status} snapshot state is explicit`, async ({ page }) => {
    await page.route('**/api/v1/summary?**', async (route) => {
      const response = await route.fetch()
      const body = await response.json() as Record<string, unknown>
      await route.fulfill({ response, json: { ...body, status } })
    })
    await page.goto('/')
    await expect(page.locator(`.status-${status}`).first()).toContainText(status)
  })
}

test('empty recommendation state is explicit', async ({ page }) => {
  await page.route('**/api/v1/opportunities?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/v1/advisor?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Where can I save money?', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Where can I save money?', exact: true }).click()
  await expect(page.getByText('Azure Advisor returned no cost recommendations for this scope.')).toBeVisible()
  await page.getByText('Sources and report', { exact: true }).click()
  await page.locator('.answer-evidence').getByText('Advisor evidence', { exact: true }).click()
  await expect(page.getByText('No Azure Advisor cost findings')).toBeVisible()
})

test('loading, unauthorized, and failed states are explicit', async ({ browser }) => {
  const loadingContext = await browser.newContext()
  const loadingPage = await loadingContext.newPage()
  await loadingPage.route('**/api/v1/cache-status?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 750))
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ready"}' })
  })
  await loadingPage.goto('http://127.0.0.1:8080/')
  await expect(loadingPage.getByText('Loading validated snapshot', { exact: true })).toBeVisible()
  await loadingContext.close()

  const unauthorizedContext = await browser.newContext()
  const unauthorizedPage = await unauthorizedContext.newPage()
  await unauthorizedPage.route('**/api/v1/summary?**', (route) => route.fulfill({ status: 401 }))
  await unauthorizedPage.goto('http://127.0.0.1:8080/')
  await expect(unauthorizedPage.getByRole('heading', { name: 'Sign in required' })).toBeVisible()
  await unauthorizedContext.close()

  const failedContext = await browser.newContext()
  const failedPage = await failedContext.newPage()
  await failedPage.route('**/api/v1/cache-status?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"failed"}' }))
  await failedPage.goto('http://127.0.0.1:8080/')
  await expect(failedPage.getByText('Snapshot unavailable', { exact: true })).toBeVisible()
  await failedContext.close()
})

test('snapshot visual contract remains at least 95 percent similar', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled({ timeout: 30_000 })
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot(`aco-agent-first-${testInfo.project.name}.png`, {
    fullPage: true,
    maxDiffPixelRatio: 0.05,
  })
})

test('snapshot dashboard first paint is at most 1000 milliseconds at p95', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The reference first-paint metric uses the desktop viewport.')
  const samples: number[] = []
  for (let index = 0; index < 20; index += 1) {
    const startedAt = Date.now()
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled({ timeout: 30_000 })
    samples.push(Date.now() - startedAt)
  }
  samples.sort((left, right) => left - right)
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]
  testInfo.annotations.push({ type: 'snapshot-first-paint-p95-ms', description: String(p95) })
  console.log(`SNAPSHOT_FIRST_PAINT_P95_MS=${p95}`)
  expect(p95).toBeLessThanOrEqual(1_000)
})

test('prepared answers use zero network calls and exact report-bound cache reuse', async ({ page }) => {
  await page.route('**/api/v1/summary?**', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...await response.json(), collectedAt: new Date().toISOString(), status: 'fresh' } })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  const calls: string[] = []
  page.on('request', (request) => { if (request.url().includes('/api/')) calls.push(request.url()) })
  await page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true }).click()
  await expect(page.getByText('Snapshot answer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cost intelligence summary', exact: true }).click()
  await expect(page.getByText('Cached answer', { exact: true })).toBeVisible()
  expect(calls).toEqual([])
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
})

test('historical answers disclose actual period and cannot become fresh cache hits', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true }).click()
  await expect(page.getByText(/Actual source period:/)).toContainText('Sep 3, 2026')
  await expect(page.getByText('Historical or incomplete evidence. Refresh before prioritizing actions.')).toBeVisible()
  await page.getByRole('button', { name: 'Cost intelligence summary', exact: true }).click()
  await expect(page.getByText('Cached answer', { exact: true })).toHaveCount(0)
})

test('refresh invalidates prepared answers while period selection remains provider-free', async ({ page }) => {
  let revision = 1
  await page.route('**/api/v1/summary?**', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...await response.json(), reportId: `rpt_revision_${revision}`, collectedAt: new Date().toISOString(), status: 'fresh' } })
  })
  await page.route('**/api/v1/refresh?**', async (route) => { revision++; await route.fulfill({ status: 202, json: { operationId: 'refresh-test', status: 'warming' } }) })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh data' }).click()
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true }).click()
  await expect(page.getByText('Cached answer', { exact: true })).toHaveCount(0)
  await page.getByText('Sources and report', { exact: true }).click()
  await expect(page.getByText('rpt_revision_2', { exact: true })).toBeVisible()
})

test('answer layouts and diagrams remain visible without page overflow', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Draw a cost allocation diagram', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Draw a cost allocation diagram', exact: true }).click()
  await expect(page.locator('.diagram-node').first()).toBeVisible()
  await page.getByRole('button', { name: 'Find savings to review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Savings to review' })).toBeVisible()
  await page.getByRole('heading', { name: 'Savings to review' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `../../.artifacts/agent-first-review-${testInfo.project.name}.png` })
  const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
  expect(overflow.content).toBeLessThanOrEqual(overflow.width)
  expect(errors).toEqual([])
})

test('free-form follow-ups retain conversation identity through prepared answers and render safe Markdown tables', async ({ page }) => {
  const requests: Array<{ conversationId: string | null; message: string }> = []
  await page.route('**/api/v1/agent/responses/stream', async (route) => {
    requests.push(route.request().postDataJSON())
    const content = '## Answer\n| Service | Cost |\n| --- | --- |\n| Example service | USD 12.34 |\n\n![remote image](https://example.invalid/image.png)\n<script>alert(1)</script>'
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: `event: meta\ndata: {"conversationId":"conv_scoped_test"}\n\nevent: delta\ndata: ${JSON.stringify({ text: content })}\n\nevent: done\ndata: {}\n\n` })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  const external: string[] = []
  const appOrigin = new URL(page.url()).origin
  page.on('request', (request) => { if (new URL(request.url()).origin !== appOrigin) external.push(request.url()) })
  await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Explain the main driver for this period.')
  await page.getByRole('button', { name: 'Send question' }).click()
  await expect(page.locator('.message-content table')).toBeVisible()
  await expect(page.locator('.streaming-cursor')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cost intelligence summary', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cost intelligence summary', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Question for ACO' }).fill('What risk should I consider for that service?')
  await page.getByRole('button', { name: 'Send question' }).click()
  await expect(page.locator('.message-content table')).toHaveCount(2)
  expect(requests[0].conversationId).toBeNull()
  expect(requests[1].conversationId).toBe('conv_scoped_test')
  expect(requests[1].message).toContain('Previous prepared question: Show my cost intelligence summary')
  await expect(page.locator('.message-content img, .message-content script')).toHaveCount(0)
  expect(external).toEqual([])
})

test('stop response cancels waiting and permits a new conversation', async ({ page }) => {
  await page.route('**/api/v1/agent/responses/stream', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.fulfill({ contentType: 'text/event-stream', body: 'event: done\ndata: {}\n\n' }).catch(() => undefined)
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
  await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Investigate this subscription.')
  await page.getByRole('button', { name: 'Send question' }).click()
  await page.getByRole('button', { name: 'Stop response' }).click()
  await expect(page.getByText('Response stopped.', { exact: true })).toBeVisible()
  await page.locator('.topbar').getByRole('button', { name: 'New conversation' }).click()
  await expect(page.locator('.chat-message')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Question for ACO' })).toBeFocused()
})

test('live Foundry answers ordinary questions and follow-ups within budget', async ({ page }, testInfo) => {
  test.skip(process.env.ACO_LIVE_SMOKE !== 'true', 'Live model calls require explicit opt-in.')
  test.setTimeout(360_000)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled({ timeout: 125_000 })
  await page.evaluate(() => {
    type CapturedResponse = { status: number; body: string; firstSectionAt: number; doneAt: number }
    const observedWindow = window as typeof window & { acoLiveResponses: CapturedResponse[] }
    observedWindow.acoLiveResponses = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, options) => {
      const response = await originalFetch(input, options)
      if (String(input).endsWith('/api/v1/agent/responses/stream')) {
        void (async () => {
          const reader = response.clone().body!.getReader()
          const decoder = new TextDecoder()
          let body = '', frames = '', firstSectionAt = 0, doneAt = 0
          try {
            while (true) {
              const chunk = await reader.read()
              const text = decoder.decode(chunk.value, { stream: !chunk.done })
              body += text
              frames += text
              const complete = frames.split(/\r?\n\r?\n/)
              frames = complete.pop() ?? ''
              for (const frame of complete) {
                if (frame.startsWith('event: section') && !firstSectionAt) firstSectionAt = performance.now()
                if (frame.startsWith('event: done')) doneAt = performance.now()
              }
              if (chunk.done) break
            }
            observedWindow.acoLiveResponses.push({ status: response.status, body, firstSectionAt, doneAt })
          } finally { reader.releaseLock() }
        })()
      }
      return response
    }
  })
  const prompts = [
    'Why is my Azure bill high and what should I review first to save money?',
    'Which service is the biggest cost driver, and what evidence should I check before making a decision?',
    'Show a table and graph of daily spend and explain what it does and does not prove.',
  ]
  let conversationId: string | undefined
  for (const [index, prompt] of prompts.entries()) {
    await page.getByRole('textbox', { name: 'Question for ACO' }).fill(prompt)
    await page.getByRole('button', { name: 'Send question', exact: true }).click()
    await page.waitForFunction((count) => (window as typeof window & { acoLiveResponses: unknown[] }).acoLiveResponses.length === count, index + 1, { timeout: 75_000 })
    const captured = await page.evaluate((responseIndex) => (window as typeof window & { acoLiveResponses: Array<{ status: number; body: string; firstSectionAt: number; doneAt: number }> }).acoLiveResponses[responseIndex], index)
    const events = captured.body.split(/\r?\n\r?\n/).flatMap((block) => {
      const type = block.match(/^event: (.+)$/m)?.[1]
      const data = block.match(/^data: (.+)$/m)?.[1]
      return type && data ? [{ type, data: JSON.parse(data) as Record<string, unknown> }] : []
    })
    const done = events.find((event) => event.type === 'done')?.data
    const meta = events.find((event) => event.type === 'meta')?.data
    const error = events.find((event) => event.type === 'error')?.data
    expect(captured.status).toBe(200)
    expect(error, JSON.stringify(error)).toBeUndefined()
    expect(done?.validated, JSON.stringify(done)).toBe(true)
    expect(Number(done?.modelCalls)).toBeLessThanOrEqual(3)
    expect(Number(done?.modelCalls)).toBeGreaterThan(0)
    expect(events.filter((event) => event.type === 'section').map((event) => event.data.id)).toEqual(['answer', 'evidence', 'dataHealth', 'risks', 'nextAction'])
    expect(captured.firstSectionAt).toBeGreaterThan(0)
    expect(captured.doneAt).toBeGreaterThan(captured.firstSectionAt)
    const activities = events.filter((event) => event.type === 'tool')
    for (const started of activities.filter((event) => event.data.state === 'running')) {
      expect(activities.some((event) => event.data.callId === started.data.callId && event.data.name === started.data.name && event.data.state === 'completed')).toBe(true)
    }
    expect(activities.filter((event) => event.data.state === 'running').length).toBe(Number(done?.toolCalls))
    if (conversationId) expect(meta?.conversationId).toBe(conversationId)
    conversationId = String(meta?.conversationId)
    await expect(page.locator('.streaming-cursor')).toHaveCount(0)
    await expect(page.locator('.chat-message.assistant').last()).toContainText('AI-generated')
    await expect(page.locator('.chat-message.assistant').last()).not.toContainText('ACO could not complete')
    console.log(`LIVE_ACO_TURN_${index + 1}=${JSON.stringify({ validated: done?.validated, modelCalls: done?.modelCalls, toolCalls: done?.toolCalls, sections: events.filter((event) => event.type === 'section').length, firstSectionBeforeDoneMs: Math.round(captured.doneAt - captured.firstSectionAt) })}`)
  }
  await expect(page.locator('.chat-message.assistant').last().locator('.artifact-chart .recharts-surface')).toBeVisible()
  await expect(page.locator('.chat-message.assistant').last().getByRole('table', { name: /Daily spend/ })).toBeVisible()
  const chart = page.locator('.chat-message.assistant').last().getByRole('figure', { name: /Daily cost/ })
  await chart.getByRole('button', { name: 'Bar chart', exact: true }).click()
  await expect(chart.getByRole('button', { name: 'Bar chart', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const downloadPromise = page.waitForEvent('download')
  await chart.getByRole('button', { name: 'Download chart PNG', exact: true }).click()
  const downloaded = await downloadPromise
  expect(await downloaded.failure()).toBeNull()
  const downloadPath = await downloaded.path()
  expect((await readFile(downloadPath!)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  await page.screenshot({ path: `../../.artifacts/live-aco-${testInfo.project.name}.png` })
})

for (const boundary of ['refresh', 'agent'] as const) {
  test(`${boundary} authorization denial clears prepared answers and blocks reuse`, async ({ page }) => {
    await page.route('**/api/v1/summary?**', async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...await response.json(), collectedAt: new Date().toISOString(), status: 'fresh' } })
    })
    const deniedRoute = boundary === 'refresh' ? '**/api/v1/refresh?**' : '**/api/v1/agent/responses/stream'
    await page.route(deniedRoute, (route) => route.fulfill({ status: 401, json: { message: 'Access denied' } }))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true }).click()
    await page.getByRole('button', { name: 'Cost intelligence summary', exact: true }).click()
    await expect(page.getByText('Cached answer', { exact: true })).toBeVisible()
    if (boundary === 'refresh') await page.getByRole('button', { name: 'Refresh data' }).click()
    else {
      await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Explain the cause of this cost.')
      await page.getByRole('button', { name: 'Send question' }).click()
    }
    await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible()
    await expect(page.locator('.chat-message')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Show my cost intelligence summary', exact: true })).toBeDisabled()
    await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Show my cost intelligence summary')
    await page.keyboard.press('Enter')
    await expect(page.locator('.chat-message')).toHaveCount(0)
  })
}

const responseOrigin = 'http://aco-response.test'
const responseReceipt = 'ev_cost_0123456789abcdef0123456789abcdef'
const advisorReceipt = 'ev_advisor_abcdef0123456789abcdef0123456789'
const responsePeriod = { start: '2026-09-01', end: '2026-09-18' }
const responseReport = 'rpt_response_mock'
const responseMeta = { conversationId: 'conv_response_mock', reportId: responseReport, scope: 'solution-scope', period: responsePeriod }
const responseChart = {
  kind: 'chart', title: 'Service cost / verified evidence', chartType: 'bar', currency: 'USD',
  series: [{ label: 'Azure Container Apps', value: '173.80' }, { label: 'Storage', value: '54.20' }, { label: 'Credit adjustment', value: '-1.25' }],
  evidenceIds: [responseReceipt], reportId: responseReport, period: responsePeriod,
}
const responseTable = {
  kind: 'table', title: 'Verified service values', currency: 'USD',
  columns: [{ key: 'service', label: 'Service', type: 'text' }, { key: 'cost', label: 'Billed cost', type: 'money' }, { key: 'units', label: 'Units', type: 'number' }],
  rows: [{ service: 'Large exact amount', cost: '9007199254740993.235', units: '9007199254740993' }, { service: 'Credit', cost: '-0.005', units: '1' }, { service: '<img src="https://example.invalid/private">', cost: null, units: null }],
  evidenceIds: [responseReceipt], reportId: responseReport, period: responsePeriod,
}
type ResponseMockWindow = typeof window & {
  acoResponseMock: {
    controller?: ReadableStreamDefaultController<Uint8Array>
    requests: Array<{ message: string }>
    createdUrls: string[]
    revokedUrls: string[]
    finishPng?: () => void
  }
}
const responseObservations = new WeakMap<Page, { unexpected: string[]; requests: string[]; errors: string[] }>()

async function installResponseMocks(page: Page) {
  const observation = { unexpected: [] as string[], requests: [] as string[], errors: [] as string[] }
  responseObservations.set(page, observation)
  page.on('pageerror', (error) => observation.errors.push(error.message))
  page.on('request', (request) => observation.requests.push(request.url()))
  const assets = process.env.ACO_RESPONSE_DIST ?? join(tmpdir(), 'aco-response-layer-build')
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== responseOrigin) { observation.unexpected.push(url.href); await route.abort(); return }
    const fixtures: Record<string, unknown> = {
      '/auth/config': { hosted: false, dataProfile: 'solution_snapshot', intelligenceProvider: 'none' },
      '/api/v1/cache-status': { status: 'ready' },
      '/api/v1/summary': { reportId: responseReport, scopeAlias: 'solution-scope', periodKey: 'mtd', periodLabel: 'This month', requestedPeriod: responsePeriod, financialBasis: 'billed', totalCost: { amount: '226.75', currency: 'USD' }, totalEstimatedAnnualSavings: null, collectedAt: new Date().toISOString(), status: 'fresh', services: responseChart.series.map((item) => ({ name: item.label, amount: item.value })), daily: [{ date: '2026-09-15', amount: '100.10' }, { date: '2026-09-16', amount: '127.90' }, { date: '2026-09-17', amount: '-1.25' }] },
      '/api/v1/opportunities': [],
      '/api/v1/advisor': [],
      '/api/v1/data-health': { status: 'fresh', sourceReceiptHashes: ['mock-hash'], excludedRows: 0, resourceCount: 3, sources: [{ source: 'cost-management-query', actualPeriod: responsePeriod, evidenceIds: [responseReceipt] }, { source: 'advisor', actualPeriod: responsePeriod, evidenceIds: [advisorReceipt] }] },
    }
    if (Object.hasOwn(fixtures, url.pathname)) { await route.fulfill({ json: fixtures[url.pathname] }); return }
    if (url.pathname === '/') {
      await route.fulfill({ path: join(assets, 'index.html'), contentType: 'text/html', headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'" } })
      return
    }
    if (/^\/assets\/[a-zA-Z0-9_.-]+$/.test(url.pathname) || /^\/[a-zA-Z0-9_-]+\.(svg|png|ico)$/.test(url.pathname)) { await route.fulfill({ path: join(assets, url.pathname.slice(1)) }); return }
    observation.unexpected.push(url.href)
    await route.abort()
  })
  await page.addInitScript(() => {
    const mockWindow = window as ResponseMockWindow
    const mock = mockWindow.acoResponseMock = { requests: [], createdUrls: [], revokedUrls: [] } as ResponseMockWindow['acoResponseMock']
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, options) => {
      const address = input instanceof Request ? input.url : String(input)
      if (new URL(address, location.href).pathname !== '/api/v1/agent/responses/stream') return originalFetch(input, options)
      mock.requests.push(JSON.parse(String(options?.body)))
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          mock.controller = controller
          options?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true })
        },
        cancel() { mock.controller = undefined },
      })
      return Promise.resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))
    }
    const createUrl = URL.createObjectURL.bind(URL)
    const revokeUrl = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (blob) => { const url = createUrl(blob); mock.createdUrls.push(url); return url }
    URL.revokeObjectURL = (url) => { mock.revokedUrls.push(url); revokeUrl(url) }
  })
}

async function beginMockResponse(page: Page) {
  await page.goto(responseOrigin)
  await expect(page.getByRole('textbox', { name: 'Question for ACO' })).toBeEnabled()
  await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Explain the evidence behind the leading service.')
  await page.getByRole('button', { name: 'Send question' }).click()
  await page.waitForFunction(() => Boolean((window as ResponseMockWindow).acoResponseMock.controller))
}

function mockFrame(type: string, data: unknown) { return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n` }
async function pushMockBytes(page: Page, body: string) {
  await page.evaluate((chunk) => (window as ResponseMockWindow).acoResponseMock.controller?.enqueue(new TextEncoder().encode(chunk)), body)
}
async function pushMockEvents(page: Page, events: Array<[string, unknown]>) { await pushMockBytes(page, events.map(([type, data]) => mockFrame(type, data)).join('')) }
async function showMockArtifact(page: Page, artifact: unknown) {
  await beginMockResponse(page)
  await pushMockEvents(page, [['meta', responseMeta], ['artifact', artifact], ['done', { validated: true, modelCalls: 1 }]])
  await expect(page.locator('.streaming-cursor')).toHaveCount(0)
}

test.describe('response layer (mocked)', () => {
  test.use({ serviceWorkers: 'block' })
  test.beforeEach(async ({ page }) => installResponseMocks(page))
  test.afterEach(async ({ page }) => {
    expect(responseObservations.get(page)?.unexpected).toEqual([])
    expect(responseObservations.get(page)?.errors).toEqual([])
  })

  test('sending dictated text clears the composer and ignores late speech results', async ({ page }) => {
    await page.addInitScript(() => {
      type SpeechResult = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> }
      type SpeechHandler = ((event: SpeechResult) => void) | null
      type SpeechMockState = { current?: MockRecognition; lateResult?: SpeechHandler }
      class MockRecognition {
        lang = ''
        continuous = false
        interimResults = false
        maxAlternatives = 1
        onresult: SpeechHandler = null
        onerror: ((event: { error?: string }) => void) | null = null
        onend: (() => void) | null = null
        start() { (window as typeof window & { acoSpeechMock: SpeechMockState }).acoSpeechMock.current = this }
        stop() { this.onend?.() }
        abort() {}
      }
      const speechWindow = window as typeof window & { SpeechRecognition: typeof MockRecognition; acoSpeechMock: SpeechMockState }
      speechWindow.acoSpeechMock = {}
      speechWindow.SpeechRecognition = MockRecognition
    })

    await page.goto(responseOrigin)
    await expect(page.getByRole('textbox', { name: 'Question for ACO' })).toBeEnabled()
    await page.getByRole('button', { name: 'Dictate your question' }).click()
    await page.evaluate(() => {
      type SpeechResult = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> }
      type SpeechHandler = ((event: SpeechResult) => void) | null
      const mock = (window as typeof window & { acoSpeechMock: { current?: { onresult: SpeechHandler }; lateResult?: SpeechHandler } }).acoSpeechMock
      mock.current?.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'Explain my leading cost driver' } }] })
      mock.lateResult = mock.current?.onresult
    })
    const composer = page.getByRole('textbox', { name: 'Question for ACO' })
    await expect(composer).toHaveValue('Explain my leading cost driver')
    await page.getByRole('button', { name: 'Send question' }).click()
    await page.waitForFunction(() => (window as ResponseMockWindow).acoResponseMock.requests.length === 1)
    await expect(composer).toHaveValue('')

    await page.evaluate(() => {
      type SpeechResult = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> }
      type SpeechHandler = ((event: SpeechResult) => void) | null
      const mock = (window as typeof window & { acoSpeechMock: { lateResult?: SpeechHandler } }).acoSpeechMock
      mock.lateResult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Explain my leading cost driver' } }] })
    })

    await expect(composer).toHaveValue('')
    await expect(page.locator('.chat-message.user')).toHaveCount(1)
    expect(await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.requests.length)).toBe(1)
    await pushMockEvents(page, [['done', { validated: true }]])
    await expect(page.getByRole('button', { name: 'Send question' })).toBeDisabled()
  })

  test('a validation retry keeps one response footprint instead of appearing to submit twice', async ({ page }) => {
    await beginMockResponse(page)
    const original = `Original checked attempt. ${'This content gives the response enough height to expose a transcript collapse. '.repeat(18)}`
    await pushMockEvents(page, [['section', { id: 'answer', title: 'Answer', markdown: original, evidenceIds: [responseReceipt] }]])
    await expect(page.getByText(/Original checked attempt/)).toBeVisible()
    const assistant = page.locator('.chat-message.assistant').last()
    const before = await assistant.evaluate((element) => element.getBoundingClientRect().height)
    const viewport = await page.locator('.conversation-main').evaluate((element) => element.clientHeight)

    await pushMockEvents(page, [['reset', { reason: 'response-validation-failed' }]])
    await expect(page.getByText(/Original checked attempt/)).toHaveCount(0)
    await expect(page.getByText('ACO is rechecking the response', { exact: true })).toBeVisible()
    const after = await assistant.evaluate((element) => element.getBoundingClientRect().height)
    expect(after).toBeGreaterThanOrEqual(Math.min(before, Math.max(160, viewport * .72)) - 2)
    await expect(page.locator('.chat-message.user')).toHaveCount(1)
    expect(await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.requests.length)).toBe(1)

    await pushMockEvents(page, [
      ['section', { id: 'answer', title: 'Answer', markdown: 'The replacement attempt passed its checks.', evidenceIds: [responseReceipt] }],
      ['done', { validated: true }],
    ])
    await expect(page.getByText('The replacement attempt passed its checks.', { exact: true })).toBeVisible()
    expect(await assistant.locator('.streamed-answer').evaluate((element) => getComputedStyle(element).minHeight)).toBe('0px')
  })

  test('streaming motion visibly reveals checked words and animates real activity', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await beginMockResponse(page)
    expect(await page.locator('.aco-thinking-dots i').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('aco-dot-wave')
    await pushMockEvents(page, [['tool', { callId: 'motion-call', name: 'get_cost_summary', state: 'running' }]])
    expect(await page.locator('.tool-spinner').evaluate((element) => getComputedStyle(element).animationName)).toBe('refresh-spin')
    const text = 'Your cost summary is ready. Review service allocation and the source evidence before deciding on a change. '.repeat(3)
    await pushMockEvents(page, [['section', { id: 'answer', title: 'Answer', markdown: text, evidenceIds: [responseReceipt] }]])
    const reveal = page.locator('.section-reveal')
    await expect(reveal.locator('.stream-word')).not.toHaveCount(0)
    const frames = await reveal.evaluate((element) => {
      const words = [...element.querySelectorAll<HTMLElement>('.stream-word')]
      const animations = words.flatMap((word) => word.getAnimations())
      animations.forEach((animation) => { animation.pause(); animation.currentTime = 0 })
      const first = words.map((word) => Number(getComputedStyle(word).opacity))
      animations.forEach((animation) => { animation.currentTime = 600 })
      const middle = words.map((word) => Number(getComputedStyle(word).opacity))
      return { animations: animations.length, firstHidden: first.filter((value) => value === 0).length, middleVisible: middle.filter((value) => value === 1).length, middleHidden: middle.filter((value) => value === 0).length, total: words.length }
    })
    expect(frames.animations).toBe(frames.total)
    expect(frames.firstHidden).toBe(frames.total)
    expect(frames.middleVisible).toBeGreaterThan(0)
    expect(frames.middleHidden).toBeGreaterThan(0)
    await pushMockEvents(page, [['tool', { callId: 'motion-call', name: 'get_cost_summary', state: 'completed' }], ['tool', { callId: 'compose-call', name: 'compose_response', state: 'running' }]])
    await expect(page.locator('.response-tools li')).toHaveCount(1)
    await expect(page.locator('.response-tools')).not.toContainText('Combining evidence')
    await expect(page.locator('.compose-activity')).toContainText('Checking citations, totals and response structure')
    await expect(page.locator('.compose-mark .aci-mark rect')).toHaveCount(3)
    expect(await page.locator('.compose-mark .aci-mark rect').evaluateAll((layers) => layers.every((layer) => getComputedStyle(layer).animationName === 'compose-stack-layer'))).toBe(true)
    await expect(page.locator('.compose-dots i')).toHaveCount(3)
    expect(await page.locator('.compose-dots i').evaluateAll((dots) => dots.every((dot) => getComputedStyle(dot).animationName === 'aco-dot-wave'))).toBe(true)
    await expect(page.locator('.compose-cursor')).toHaveCount(0)
    await page.screenshot({ path: `../../.artifacts/streaming-motion-${testInfo.project.name}.png` })
    await pushMockEvents(page, [['tool', { callId: 'compose-call', name: 'compose_response', state: 'completed' }], ['done', { validated: true }]])
    await expect(page.locator('.tool-spinner, .aco-thinking-dots')).toHaveCount(0)
    await expect(page.locator('.compose-activity')).toContainText('Evidence and response checks completed')
    await expect(page.locator('.compose-state')).toContainText('Completed')
    expect(await reveal.locator('.stream-word').last().evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(0)
    await reveal.evaluate((element) => element.querySelectorAll('.stream-word').forEach((word) => word.getAnimations().forEach((animation) => animation.finish())))
    await expect(reveal).not.toHaveAttribute('data-revealing', 'true')
    await expect(reveal).toContainText('Your cost summary is ready.')
    const bounds = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    expect(bounds.content).toBeLessThanOrEqual(bounds.width)
  })

  test('stream growth stays pinned until explicit upward input releases follow mode', async ({ page }) => {
    await beginMockResponse(page)
    const main = page.locator('.conversation-main')
    const longText = 'Checked evidence remains readable while the response grows. '.repeat(70)
    await pushMockEvents(page, [['section', { id: 'answer', title: 'Answer', markdown: longText, evidenceIds: [responseReceipt] }]])
    await page.waitForFunction(() => { const element = document.querySelector('.conversation-main'); return Boolean(element && element.scrollHeight - element.scrollTop - element.clientHeight < 4) })
    await pushMockEvents(page, [['section', { id: 'evidence', title: 'Evidence', markdown: longText, evidenceIds: [responseReceipt] }]])
    await page.waitForFunction(() => { const element = document.querySelector('.conversation-main'); return Boolean(element && element.scrollHeight - element.scrollTop - element.clientHeight < 4) })
    await expect(page.getByRole('button', { name: 'Latest answer' })).toHaveCount(0)

    await main.dispatchEvent('wheel', { deltaY: -120 })
    const releasedTop = await main.evaluate((element) => element.scrollTop)
    await pushMockEvents(page, [['section', { id: 'dataHealth', title: 'Data health', markdown: longText, evidenceIds: [responseReceipt] }]])
    await expect(page.getByRole('button', { name: 'Latest answer' })).toBeVisible()
    expect(await main.evaluate((element, top) => Math.abs(element.scrollTop - top), releasedTop)).toBeLessThan(4)

    await page.getByRole('button', { name: 'Latest answer' }).click()
    await page.waitForFunction(() => { const element = document.querySelector('.conversation-main'); return Boolean(element && element.scrollHeight - element.scrollTop - element.clientHeight < 4) })
    await expect(page.getByRole('button', { name: 'Latest answer' })).toHaveCount(0)
    await pushMockEvents(page, [['done', { validated: true }]])
  })

  test('reduced motion uses opacity-only checked-text streaming while status feedback remains live', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await beginMockResponse(page)
    expect(await page.locator('.aco-thinking-dots i').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('aco-dot-pulse')
    await pushMockEvents(page, [['section', { id: 'answer', title: 'Answer', markdown: 'All checked words are available immediately.', evidenceIds: [responseReceipt] }]])
    await expect(page.locator('.section-reveal')).toBeVisible()
    expect(await page.locator('.stream-word').evaluateAll((words) => words.every((word) => word.getAnimations().length === 1 && getComputedStyle(word).transform === 'none'))).toBe(true)
    await page.getByRole('button', { name: 'Stop response' }).click()
    expect(await page.locator('.stream-word').evaluateAll((words) => words.every((word) => getComputedStyle(word).opacity === '1'))).toBe(true)
  })

  test('checked sections render before done and never expose unfinished JSON', async ({ page }) => {
    await beginMockResponse(page)
    await pushMockEvents(page, [['meta', responseMeta]])
    const answer = mockFrame('section', { id: 'answer', title: 'Answer', markdown: 'The first checked block is available.', evidenceIds: [responseReceipt] })
    await pushMockBytes(page, answer.slice(0, -2))
    await expect(page.getByRole('heading', { name: 'Answer', exact: true })).toHaveCount(0)
    await pushMockBytes(page, '\n\n')
    await expect(page.getByText('The first checked block is available.', { exact: true })).toBeVisible()
    await expect(page.locator('.streaming-cursor')).toBeVisible()
    await expect(page.locator('.response-validation')).toHaveCount(0)
    for (const [id, title] of [['evidence', 'Evidence'], ['dataHealth', 'Data health'], ['risks', 'Risks'], ['nextAction', 'Next action']]) {
      await pushMockEvents(page, [['section', { id, title, markdown: `Checked ${id} block.`, evidenceIds: [responseReceipt] }]])
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    }
    await expect(page.locator('.response-section')).toHaveCount(5)
    await expect(page.locator('.chat-message.assistant')).not.toContainText('"evidenceIds"')
    await pushMockEvents(page, [['done', { validated: true }]])
    await expect(page.locator('.response-validation')).toHaveText('Validated response')
    await expect(page.locator('.streaming-cursor')).toHaveCount(0)
  })

  test('partial errors retain checked sections and artifacts and cannot become success', async ({ page }) => {
    await beginMockResponse(page)
    await pushMockEvents(page, [['meta', responseMeta], ['section', { id: 'answer', title: 'Answer', markdown: 'Retained checked evidence.', evidenceIds: [responseReceipt] }], ['artifact', responseTable]])
    await expect(page.getByText('Retained checked evidence.', { exact: true })).toBeVisible()
    await pushMockEvents(page, [['error', { code: 'section_validation_failed', message: 'The next section could not be validated.', partial: true }], ['done', { validated: true }]])
    await expect(page.getByRole('alert')).toContainText('Response incomplete')
    await expect(page.getByRole('alert')).toContainText('section_validation_failed')
    await expect(page.getByText('Retained checked evidence.', { exact: true })).toBeVisible()
    await expect(page.getByRole('table', { name: responseTable.title, exact: true })).toBeVisible()
    await expect(page.locator('.response-sources .evidence-badge')).toHaveCount(1)
    await expect(page.locator('.response-validation, .streaming-cursor')).toHaveCount(0)
  })

  test('premature disconnect retains checked sections with an incomplete warning', async ({ page }) => {
    await beginMockResponse(page)
    await pushMockEvents(page, [['section', { id: 'answer', title: 'Answer', markdown: 'Checked before disconnect.', evidenceIds: [responseReceipt] }]])
    await expect(page.getByText('Checked before disconnect.', { exact: true })).toBeVisible()
    await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.controller?.close())
    await expect(page.getByRole('alert')).toContainText('The connection ended')
    await expect(page.getByText('Checked before disconnect.', { exact: true })).toBeVisible()
    await expect(page.locator('.response-validation')).toHaveCount(0)
  })

  test('stopping a response retains checked sections and permits another question', async ({ page }) => {
    await beginMockResponse(page)
    await pushMockEvents(page, [['section', { id: 'answer', title: 'Answer', markdown: 'Checked before stop.', evidenceIds: [responseReceipt] }]])
    await expect(page.getByText('Checked before stop.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Stop response' }).click()
    await expect(page.getByRole('alert')).toContainText('Response stopped.')
    await expect(page.getByText('Checked before stop.', { exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Another question')
    await expect(page.getByRole('button', { name: 'Send question' })).toBeEnabled()
  })

  test('tool activity uses only wrapper events and genuine completion states', async ({ page }) => {
    await beginMockResponse(page)
    await expect(page.locator('.response-tools')).toHaveCount(0)
    await pushMockEvents(page, [['tool', { callId: 'cost-call', name: 'get_cost_summary', state: 'running' }]])
    await expect(page.locator('.response-tools')).toContainText('Reading cost summary')
    await expect(page.locator('.tool-state')).toHaveText('Running')
    await pushMockEvents(page, [['tool', { callId: 'cost-call', name: 'get_cost_summary', state: 'completed' }], ['tool', { callId: 'advisor-call', name: 'get_advisor_findings', state: 'failed' }], ['tool', { callId: 'pending-call', name: 'get_evidence', state: 'running' }], ['done', { validated: false }]])
    await expect(page.locator('.response-tools li')).toHaveCount(3)
    await expect(page.locator('.tool-completed')).toHaveText('Completed')
    await expect(page.locator('.tool-failed')).toHaveText('Failed')
    await expect(page.locator('.tool-running')).toHaveText('Completion not confirmed')
    await page.locator('.response-tools summary').first().click()
    await expect(page.locator('.tool-detail').first()).toContainText('get_cost_summary')
    await expect(page.locator('.tool-detail').first()).toContainText('cost-call')
  })

  test('source badges use ledger mappings and disclose unmapped IDs without external content', async ({ page }) => {
    await beginMockResponse(page)
    const unknownId = 'ev_advisor_not_present_in_the_loaded_ledger'
    await pushMockEvents(page, [['meta', responseMeta], ['section', { id: 'evidence', title: 'Evidence', markdown: '![remote](https://example.invalid/private.png)\n<script>alert(1)</script>\n[private link](https://example.invalid/private)', evidenceIds: [responseReceipt, advisorReceipt, unknownId, responseReceipt] }], ['done', { validated: true }]])
    await expect(page.locator('.evidence-badge')).toHaveCount(3)
    await expect(page.locator('.evidence-badge summary').nth(0)).toContainText('Cost Management Query')
    await expect(page.locator('.evidence-badge summary').nth(1)).toContainText('Azure Advisor')
    await expect(page.locator('.evidence-badge summary').nth(2)).toContainText('Source list not loaded')
    const source = page.getByTitle(`Cost Management Query: ${responseReceipt}`, { exact: true })
    await source.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.evidence-badge-detail').first()).toContainText(responseReceipt)
    await expect(page.locator('.evidence-badge-detail').first()).toContainText('2026-09-01 to 2026-09-18')
    await expect(page.locator('.message-content img, .message-content script, .message-content a')).toHaveCount(0)
  })

  test('many Advisor references collapse to one source per answer', async ({ page }) => {
    const advisorIds = Array.from({ length: 13 }, (_, index) => `ev_advisor_reference_${index}`)
    await page.route('**/api/v1/data-health?**', (route) => route.fulfill({ json: { status: 'fresh', sourceReceiptHashes: ['mock-hash'], excludedRows: 0, resourceCount: 3, sources: [{ source: 'cost-details', actualPeriod: responsePeriod, evidenceIds: [responseReceipt] }, { source: 'advisor', actualPeriod: responsePeriod, evidenceIds: advisorIds }] } }))
    await beginMockResponse(page)
    for (const [id, title] of [['answer', 'Answer'], ['evidence', 'Evidence'], ['dataHealth', 'Data health'], ['risks', 'Risks'], ['nextAction', 'Next action']]) {
      await pushMockEvents(page, [['section', { id, title, markdown: 'Review the supplied evidence.', evidenceIds: [responseReceipt, ...advisorIds] }]])
    }
    await pushMockEvents(page, [['done', { validated: true }]])
    await expect(page.locator('.response-sources .evidence-badge')).toHaveCount(2)
    await expect(page.locator('.response-section .evidence-badges')).toHaveCount(0)
    await page.getByTitle('Azure Advisor: 13 evidence references', { exact: true }).click()
    await expect(page.locator('.evidence-badge[open] li')).toHaveCount(13)
    for (const id of advisorIds) await expect(page.locator('.evidence-badge[open]')).toContainText(id)
  })

  test('every suggested prompt starts a real validated stream', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    for (const prompt of preparedPrompts) {
      await page.goto(responseOrigin)
      await expect(page.getByRole('button', { name: prompt.title, exact: true })).toBeEnabled()
      if (prompt.intent === 'summary') {
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({ path: `../../.artifacts/polished-start-${testInfo.project.name}.png` })
      }
      await page.getByRole('button', { name: prompt.title, exact: true }).click()
      await page.waitForFunction(() => (window as ResponseMockWindow).acoResponseMock.requests.length === 1)
      expect(await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.requests[0].message)).toBe(prompt.title)
      await pushMockEvents(page, [
        ['meta', responseMeta],
        ['tool', { callId: `compose-${prompt.intent}`, name: 'compose_response', state: 'running' }],
        ['section', { id: 'answer', title: 'Answer', markdown: `Validated ${prompt.label}.`, evidenceIds: [responseReceipt] }],
      ])
      await expect(page.locator('.compose-mark .aci-mark rect')).toHaveCount(3)
      await pushMockEvents(page, [
        ['tool', { callId: `compose-${prompt.intent}`, name: 'compose_response', state: 'completed' }],
        ['done', { validated: true }],
      ])
      await expect(page.locator('.response-validation')).toHaveText('Validated response')
      await expect(page.getByText(`Validated ${prompt.label}.`, { exact: true })).toBeVisible()
      if (prompt.intent === 'summary') await page.screenshot({ path: `../../.artifacts/polished-summary-${testInfo.project.name}.png` })
      const bounds = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
      expect(bounds.content).toBeLessThanOrEqual(bounds.width)
    }
  })

  test('suggested and typed paraphrases retain conversation identity through real streams', async ({ page }) => {
    await page.goto(responseOrigin)
    await expect(page.getByRole('button', { name: preparedPrompts[0].title, exact: true })).toBeEnabled()
    await page.getByRole('button', { name: preparedPrompts[0].title, exact: true }).click()
    await page.waitForFunction(() => (window as ResponseMockWindow).acoResponseMock.requests.length === 1)
    await pushMockEvents(page, [['meta', responseMeta], ['section', { id: 'answer', title: 'Answer', markdown: 'First streamed answer.', evidenceIds: [responseReceipt] }], ['done', { validated: true }]])
    await page.getByRole('textbox', { name: 'Question for ACO' }).fill('Please summarize my costs.')
    await page.getByRole('button', { name: 'Send question', exact: true }).click()
    await page.waitForFunction(() => (window as ResponseMockWindow).acoResponseMock.requests.length === 2)
    const requests = await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.requests)
    expect(requests[0].message).toBe(preparedPrompts[0].title)
    expect(requests[1]).toMatchObject({ message: 'Please summarize my costs.', conversationId: responseMeta.conversationId })
    await pushMockEvents(page, [['meta', responseMeta], ['section', { id: 'answer', title: 'Answer', markdown: 'Second streamed answer.', evidenceIds: [responseReceipt] }], ['done', { validated: true }]])
    await expect(page.locator('.response-validation')).toHaveCount(2)
    await expect(page.getByText('Cached answer', { exact: true })).toHaveCount(0)
  })

  test('typed tables retain exact money, unknown values, and inert text', async ({ page }) => {
    await showMockArtifact(page, responseTable)
    const table = page.getByRole('table', { name: responseTable.title, exact: true })
    await expect(table.getByRole('columnheader')).toHaveCount(3)
    await expect(table.getByRole('row')).toHaveCount(4)
    await expect(table.getByRole('cell', { name: '$9,007,199,254,740,993.24', exact: true })).toBeVisible()
    await expect(table.getByRole('cell', { name: '-$0.01', exact: true })).toBeVisible()
    await expect(table.getByRole('cell', { name: '9007199254740993', exact: true })).toBeVisible()
    await expect(table.getByRole('cell', { name: 'Unknown', exact: true })).toHaveCount(2)
    await expect(table.locator('img')).toHaveCount(0)
    await expect(page.locator('.artifact-context')).toContainText('2026-09-01 to 2026-09-18 / USD')
    await expect(page.locator('.artifact-context')).toContainText(responseReport)
  })

  test('Advisor findings group repeated families without merging estimates or evidence', async ({ page }, testInfo) => {
    const artifact = {
      kind: 'table', title: 'Advisor review candidates - This month',
      columns: [{ key: 'title', label: 'Advisor finding', type: 'text' }, { key: 'annualSavings', label: 'Estimated annual savings', type: 'number' }, { key: 'currency', label: 'Currency', type: 'text' }, { key: 'status', label: 'Review state', type: 'text' }],
      rows: [
        { title: 'Consider Cosmos DB reserved instance', target: 'Target not supplied by Azure', annualSavings: '126', currency: 'USD', status: 'Needs human review', evidenceId: 'ev_advisor_cosmos_01' },
        { title: 'Consider Cosmos DB reserved instance', target: 'Target not supplied by Azure', annualSavings: '84', currency: 'USD', status: 'Needs human review', evidenceId: 'ev_advisor_cosmos_02' },
        { title: 'Consider purchasing a savings plan', target: 'resource-1234567890', annualSavings: '324', currency: 'USD', status: 'Needs human review', evidenceId: 'ev_advisor_plan_01' },
      ],
      evidenceIds: ['ev_advisor_cosmos_01', 'ev_advisor_cosmos_02', 'ev_advisor_plan_01'], reportId: responseReport, period: responsePeriod,
    }
    await showMockArtifact(page, artifact)
    const figure = page.getByRole('figure', { name: artifact.title, exact: true })
    const table = figure.getByRole('table', { name: artifact.title, exact: true })
    await expect(table.locator('.advisor-family-row')).toHaveCount(2)
    await expect(table.locator('.advisor-finding-row')).toHaveCount(3)
    await expect(table.locator('.advisor-family-row').first()).toContainText('2 findings')
    await expect(table.locator('.advisor-finding-row').nth(0)).toContainText('$126.00')
    await expect(table.locator('.advisor-finding-row').nth(1)).toContainText('$84.00')
    await expect(table.locator('.advisor-finding-row').nth(2)).toContainText('$324.00')
    expect((await table.locator('.advisor-finding-row').allTextContents()).every((text) => !text.includes('Consider Cosmos DB reserved instance'))).toBe(true)
    await expect(table.locator('.advisor-family-row small')).toHaveCount(2)
    expect((await table.locator('.advisor-family-row small').allTextContents()).every((text) => text.includes('Review overlap before combining them.'))).toBe(true)
    await expect(table.getByText('Target not supplied by Azure', { exact: true })).toHaveCount(0)
    await expect(table.locator('.advisor-scope-note')).toHaveCount(1)
    await expect(table.locator('.advisor-scope-note')).toContainText('did not expose their resource targets')
    await expect(table.locator('.advisor-family-guidance')).toHaveCount(2)
    await expect(table.getByText('What it means', { exact: true })).toHaveCount(2)
    await expect(table.getByText('Verify', { exact: true })).toHaveCount(2)
    await expect(table.getByText('Decision guidance', { exact: true })).toHaveCount(2)
    await expect(table.getByText('Target: resource-1234567890', { exact: true })).toBeVisible()
    await expect(figure.getByText('Azure Advisor estimates are review opportunities, not approved or realized savings.', { exact: true })).toBeVisible()
    expect(await table.locator('.advisor-finding-row .evidence-badge').count()).toBe(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
    expect(await figure.locator('.artifact-table-scroll').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await figure.screenshot({ path: testInfo.outputPath('advisor-grouped.png') })
  })

  test('FinOps phase labels remain complete words without page overflow', async ({ page }, testInfo) => {
    const artifact = {
      kind: 'table', title: 'FinOps Framework practices - This month', guidance: true,
      columns: [{ key: 'phase', label: 'Phase', type: 'text' }, { key: 'practice', label: 'Practice', type: 'text' }, { key: 'meaning', label: 'What it means here', type: 'text' }],
      rows: [
        { phase: 'Inform', practice: 'Shared accountability', meaning: 'Allocate cost to owners before changing anything.' },
        { phase: 'Optimize', practice: 'Workload optimization', meaning: 'Rightsize to observed utilization and remove waste.' },
        { phase: 'Operate', practice: 'Continuous governance', meaning: 'Track outcomes and review on a recurring cadence.' },
        { phase: 'Quantify', practice: 'Value measurement', meaning: 'Measure realized value separately from estimates.' },
      ],
      evidenceIds: [], reportId: responseReport, period: responsePeriod,
    }
    await showMockArtifact(page, artifact)
    const table = page.getByRole('table', { name: artifact.title, exact: true })
    const phaseCells = table.locator('tbody td:first-child')
    await expect(phaseCells).toHaveCount(4)
    expect(await phaseCells.evaluateAll((cells) => cells.map((cell) => {
      const style = getComputedStyle(cell)
      return { width: cell.getBoundingClientRect().width, whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap }
    }))).toEqual([
      { width: 96, whiteSpace: 'nowrap', overflowWrap: 'normal' },
      { width: 96, whiteSpace: 'nowrap', overflowWrap: 'normal' },
      { width: 96, whiteSpace: 'nowrap', overflowWrap: 'normal' },
      { width: 96, whiteSpace: 'nowrap', overflowWrap: 'normal' },
    ])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
    await table.screenshot({ path: testInfo.outputPath('finops-phase-nowrap.png') })
  })

  test('bar and line controls and the values table are keyboard accessible and local', async ({ page }) => {
    await showMockArtifact(page, responseChart)
    const chart = page.getByRole('figure', { name: responseChart.title })
    await expect(chart.locator('.recharts-surface')).toBeVisible()
    const frame = await chart.locator('.artifact-chart').boundingBox()
    const requestsBefore = [...responseObservations.get(page)!.requests]
    await expect(chart.getByRole('button', { name: 'Bar chart', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await chart.getByRole('button', { name: 'Line chart', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(chart.getByRole('button', { name: 'Line chart', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(chart.getByRole('button', { name: 'Bar chart', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(chart.locator('.recharts-line-curve')).toBeVisible()
    const lineFrame = await chart.locator('.artifact-chart').boundingBox()
    expect(lineFrame?.width).toBe(frame?.width)
    expect(lineFrame?.height).toBe(frame?.height)
    const evidenceDisclosure = chart.locator('.chart-evidence summary')
    const values = chart.locator('.chart-evidence table')
    await expect(values).toBeVisible()
    await evidenceDisclosure.focus()
    await page.keyboard.press('Enter')
    await expect(values).toBeHidden()
    await page.keyboard.press('Enter')
    await expect(values).toBeVisible()
    await expect(values.getByRole('cell', { name: '-$1.25', exact: true })).toBeVisible()
    expect(await values.getByRole('rowheader').first().evaluate((element) => getComputedStyle(element).position)).toBe('static')
    expect(await values.getByRole('columnheader').first().evaluate((element) => getComputedStyle(element).position)).toBe('sticky')
    await chart.getByRole('region', { name: `${responseChart.title} values`, exact: true }).focus()
    await expect(chart.getByRole('region', { name: `${responseChart.title} values`, exact: true })).toBeFocused()
    expect(responseObservations.get(page)!.requests).toEqual(requestsBefore)
    expect(await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.requests.length)).toBe(1)
  })

  test('PNG downloads contain the actual chart and captions with revoked URLs', async ({ page }, testInfo) => {
    await showMockArtifact(page, responseChart)
    const chart = page.getByRole('figure', { name: responseChart.title })
    await expect(chart.locator('.recharts-surface')).toBeVisible()
    const requestsBefore = [...responseObservations.get(page)!.requests]
    const exported: Buffer[] = []
    for (const mode of ['Bar', 'Line']) {
      await chart.getByRole('button', { name: `${mode} chart`, exact: true }).click()
      await expect(chart.locator(mode === 'Bar' ? '.recharts-bar-rectangle' : '.recharts-line-curve').first()).toBeVisible()
      await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.toBlob
        HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
          const mock = (window as ResponseMockWindow).acoResponseMock
          mock.finishPng = () => original.call(this, callback, type, quality)
          HTMLCanvasElement.prototype.toBlob = original
        }
      })
      const downloading = page.waitForEvent('download')
      await chart.getByRole('button', { name: 'Download chart PNG' }).click()
      await expect(chart.getByRole('button', { name: 'Download chart PNG' })).toBeDisabled()
      await expect(chart.getByRole('button', { name: 'Download chart PNG' })).toHaveAttribute('aria-busy', 'true')
      await page.waitForFunction(() => Boolean((window as ResponseMockWindow).acoResponseMock.finishPng))
      await page.evaluate(() => {
        const mock = (window as ResponseMockWindow).acoResponseMock
        mock.finishPng?.()
        mock.finishPng = undefined
      })
      const download = await downloading
      expect(download.suggestedFilename()).toBe('service-cost-verified-evidence.png')
      expect(await download.failure()).toBeNull()
      const file = await download.path()
      if (!file) throw new Error('The browser did not provide a PNG download.')
      const png = await readFile(file)
      exported.push(png)
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(png.length).toBeGreaterThan(5000)
      const pixels = await page.evaluate(async (encoded) => {
        const image = new Image()
        image.src = `data:image/png;base64,${encoded}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data
        let teal = 0
        let blue = 0
        let captionInk = 0
        for (let offset = 0; offset < rgba.length; offset += 4) {
          const red = rgba[offset], green = rgba[offset + 1], blueChannel = rgba[offset + 2]
          if (red < 40 && green > 80 && green < 180 && blueChannel > 70 && blueChannel < 170) teal++
          if (red < 40 && green > 60 && green < 150 && blueChannel > 150) blue++
          if (offset > rgba.length - canvas.width * 4 * 160 && red < 180 && green < 180 && blueChannel < 180) captionInk++
        }
        return { width: image.width, height: image.height, teal, blue, captionInk }
      }, png.toString('base64'))
      expect(pixels.width).toBeGreaterThanOrEqual(720)
      expect(pixels.height).toBeGreaterThan(600)
      expect(mode === 'Bar' ? pixels.teal : pixels.blue).toBeGreaterThan(200)
      expect(pixels.captionInk).toBeGreaterThan(200)
      await expect(chart.getByRole('button', { name: 'Download chart PNG' })).toBeEnabled()
      await testInfo.attach(`${mode.toLowerCase()}-chart.png`, { body: png, contentType: 'image/png' })
    }
    expect(exported[0].equals(exported[1])).toBe(false)
    expect(responseObservations.get(page)!.requests).toEqual(requestsBefore)
    expect(await page.evaluate(() => {
      const mock = (window as ResponseMockWindow).acoResponseMock
      return mock.createdUrls.length === 2 && mock.createdUrls.every((url) => mock.revokedUrls.includes(url))
    })).toBe(true)
    expect(await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.requests.length)).toBe(1)
  })

  test('PNG failures are explicit and leave the evidence and controls usable', async ({ page }) => {
    await showMockArtifact(page, responseChart)
    await expect(page.locator('.recharts-surface')).toBeVisible()
    await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = (callback) => callback(null) })
    await page.getByRole('button', { name: 'Download chart PNG' }).click()
    await expect(page.getByRole('alert')).toContainText('PNG export failed')
    await expect(page.getByRole('button', { name: 'Download chart PNG' })).toBeEnabled()
    await expect(page.locator('.recharts-surface')).toBeVisible()
    await expect(page.locator('.evidence-badge')).toHaveCount(1)
    expect(await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.createdUrls.length)).toBe(0)
  })

  test('streamed service and daily charts reuse local controls', async ({ page }) => {
    await page.goto(responseOrigin)
    await expect(page.getByRole('button', { name: preparedPrompts[0].title, exact: true })).toBeEnabled()
    let requestCount = 0
    for (const prompt of preparedPrompts.filter((item) => item.intent === 'services' || item.intent === 'daily')) {
      await page.getByRole('textbox', { name: 'Question for ACO' }).fill(prompt.title)
      await page.getByRole('button', { name: 'Send question' }).click()
      requestCount += 1
      await page.waitForFunction((count) => (window as ResponseMockWindow).acoResponseMock.requests.length === count, requestCount)
      await pushMockEvents(page, [['meta', responseMeta], ['artifact', { ...responseChart, title: `${prompt.label} / verified evidence`, chartType: prompt.intent === 'daily' ? 'line' : 'bar' }], ['done', { validated: true }]])
      const artifact = page.locator('.agent-artifact').filter({ has: page.locator('.artifact-chart') }).last()
      await expect(artifact.getByRole('button', { name: 'Download chart PNG' })).toBeVisible()
      await expect(artifact.locator('.artifact-context')).toContainText(responseReport)
      await expect(artifact.locator('.evidence-badge summary')).toContainText('Cost Management Query')
      await expect(artifact.locator('.evidence-badge')).toHaveCount(1)
    }
    expect(await page.evaluate(() => (window as ResponseMockWindow).acoResponseMock.requests.length)).toBe(2)
  })

  test('response sections, long labels, sources and controls fit desktop and mobile', async ({ page }, testInfo) => {
    await beginMockResponse(page)
    await pushMockEvents(page, [['meta', responseMeta], ['section', { id: 'answer', title: 'Verified cost evidence', markdown: 'A checked response with local financial artifacts.', evidenceIds: [responseReceipt] }], ['artifact', { ...responseChart, title: 'ServiceAllocationWithAnUnusuallyLongUnbrokenTitleForResponsiveVerification' }], ['artifact', responseTable], ['done', { validated: true }]])
    await expect(page.locator('.recharts-surface')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const figures = page.locator('.agent-artifact')
    for (const figure of await figures.all()) {
      await figure.scrollIntoViewIfNeeded()
      const bounds = await figure.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    }
    await page.locator('.evidence-badge summary').first().click()
    const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth, regions: [...document.querySelectorAll<HTMLElement>('.conversation-main, .chat-message, .agent-artifact')].map((element) => ({ element: element.className, difference: element.scrollWidth - element.clientWidth })) }))
    expect(overflow.content).toBeLessThanOrEqual(overflow.width)
    expect(overflow.regions.filter((region) => region.difference > 1)).toEqual([])
    await page.locator('.response-section').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('response-layer.png') })
    console.log(`RESPONSE_LAYER_SCREENSHOT=${testInfo.outputPath('response-layer.png')}`)
  })
})