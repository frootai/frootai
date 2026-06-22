---
description: "Play 23 patterns — Browser automation patterns — domain allowlist, no credential entry, screenshot analysis, action limits."
applyTo: "**/*.py, **/*.ts"
waf:
  - "reliability"
  - "security"
---

# Play 23 — Browser Automation Agent — FAI Standards

## Playwright Browser Control

Use async Playwright with explicit timeouts on every operation. Never rely on default infinite waits.

```python
from playwright.async_api import async_playwright, TimeoutError as PwTimeout

async def browse(task: dict, config: dict) -> dict:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            storage_state=None,  # no cookie persistence
            java_script_enabled=True,
        )
        context.set_default_timeout(config["timeout_ms"])  # e.g. 10000
        page = await context.new_page()

        await page.goto(task["url"], wait_until="domcontentloaded")
        await page.click(task["selector"], timeout=5000)
        await page.fill("input[name='query']", task["query"])
        await page.press("input[name='query']", "Enter")
        await page.wait_for_load_state("networkidle", timeout=8000)

        result = await page.content()
        await context.close()
        await browser.close()
        return {"html": result, "status": "ok"}
```

## Screenshot-Based Reasoning (GPT-4o Vision)

Capture viewport screenshots and send to GPT-4o for visual grounding. Resize to 1024×768 max to stay within token budget.

```python
import base64
from openai import AzureOpenAI

async def reason_from_screenshot(page, client: AzureOpenAI, goal: str) -> str:
    screenshot_bytes = await page.screenshot(type="png", full_page=False)
    b64 = base64.b64encode(screenshot_bytes).decode()

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": f"Goal: {goal}\nWhat elements should I interact with? Return JSON: {{action, selector, value}}"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "low"}},
            ],
        }],
        max_tokens=300,
        temperature=0,
    )
    return response.choices[0].message.content
```

## DOM Extraction — Accessibility Tree

Prefer accessibility snapshots over raw HTML — smaller token footprint, semantically richer.

```python
async def extract_dom_context(page) -> str:
    snapshot = await page.accessibility.snapshot()
    if not snapshot:
        return await page.inner_text("body")  # fallback
    return _flatten_a11y_tree(snapshot, depth=0, max_depth=4)

def _flatten_a11y_tree(node: dict, depth: int, max_depth: int) -> str:
    if depth > max_depth:
        return ""
    role = node.get("role", "")
    name = node.get("name", "")
    line = f"{'  ' * depth}[{role}] {name}".strip()
    children = "\n".join(
        _flatten_a11y_tree(c, depth + 1, max_depth)
        for c in node.get("children", [])
    )
    return f"{line}\n{children}" if children else line
```

## Action Planning Loop — Observe → Plan → Act → Verify

Cap iterations with `max_steps` from config. Log every step for auditability.

```python
async def agent_loop(page, client, goal: str, config: dict) -> dict:
    steps, max_steps = [], config.get("max_steps", 15)

    for i in range(max_steps):
        dom_context = await extract_dom_context(page)
        plan = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": PLANNER_PROMPT},
                {"role": "user", "content": f"Goal: {goal}\nStep: {i+1}/{max_steps}\nDOM:\n{dom_context[:4000]}"},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=200,
        )
        action = json.loads(plan.choices[0].message.content)
        steps.append(action)

        if action["type"] == "done":
            return {"status": "completed", "steps": steps, "result": action.get("result")}

        success = await execute_action(page, action)
        if not success:
            action["retry"] = True
            success = await execute_action(page, action, use_screenshot=True)
        if not success:
            return {"status": "stuck", "steps": steps, "last_action": action}

    return {"status": "max_steps_reached", "steps": steps}
```

## Navigation Strategies

```python
async def navigate(page, target: str, config: dict):
    allowed_domains = config["allowed_domains"]  # ["example.com", "docs.example.com"]

    if target.startswith("http"):
        domain = urlparse(target).netloc
        if domain not in allowed_domains:
            raise ValueError(f"Domain {domain} not in allowlist")
        await page.goto(target, wait_until="domcontentloaded")
    else:
        search_url = f"https://www.google.com/search?q={quote_plus(target)}"
        await page.goto(search_url, wait_until="domcontentloaded")
        links = await page.query_selector_all("a[href]")
        for link in links[:5]:
            href = await link.get_attribute("href")
            if href and any(d in href for d in allowed_domains):
                await link.click()
                return
        raise RuntimeError("No allowed-domain link found in search results")
```

## Form Filling with Validation

```python
async def fill_form(page, fields: list[dict]) -> dict:
    results = {}
    for field in fields:
        selector, value = field["selector"], field["value"]
        await page.wait_for_selector(selector, state="visible", timeout=5000)
        await page.fill(selector, "")  # clear first
        await page.fill(selector, value)
        actual = await page.input_value(selector)
        results[selector] = {"expected": value, "actual": actual, "match": actual == value}
    return results
```

## Error Recovery

```python
async def execute_action(page, action: dict, use_screenshot: bool = False) -> bool:
    try:
        if action["type"] == "click":
            await page.click(action["selector"], timeout=5000)
        elif action["type"] == "fill":
            await page.fill(action["selector"], action["value"], timeout=5000)
        elif action["type"] == "navigate":
            await page.goto(action["url"], wait_until="domcontentloaded", timeout=10000)
        return True
    except PwTimeout:
        if use_screenshot:
            # Fall back to screenshot reasoning for alternative selector
            alt = await reason_from_screenshot(page, client, f"Find element for: {action}")
            return await execute_action(page, json.loads(alt), use_screenshot=False)
        return False
    except Exception as e:
        logger.warning("action_failed", action=action, error=str(e))
        return False
```

## Security Sandbox

- Launch browser with `--no-sandbox` disabled — always use sandbox
- Fresh `BrowserContext` per task — no shared cookies, localStorage, or sessions
- Domain allowlist enforced before every `page.goto` — reject anything not in `config["allowed_domains"]`
- Never enter credentials — if login required, escalate to human
- Strip `Set-Cookie` headers in response interception for sensitive domains
- Kill browser process on task timeout — no orphan Chromium processes

## Rate Limiting and Politeness

```python
import asyncio

class PoliteBrowser:
    def __init__(self, min_delay: float = 1.0, max_rpm: int = 30):
        self._delay = min_delay
        self._semaphore = asyncio.Semaphore(max_rpm)

    async def request(self, page, url: str):
        async with self._semaphore:
            await asyncio.sleep(self._delay)
            await page.goto(url, wait_until="domcontentloaded")
```

Respect `robots.txt` — check before crawling. Honor `Retry-After` headers on 429 responses.

## Session Management

- One `BrowserContext` per user task — isolates cookies, cache, and storage
- `context.close()` in `finally` block — never leak browser contexts
- Set `context.set_default_timeout()` from config, not per-call
- Track active sessions with a bounded pool (`max_concurrent_browsers` from config)
- Kill sessions exceeding `max_session_duration_s` — prevents runaway agents

## Evaluation Metrics

| Metric | Target | Measurement |
| --- | --- | --- |
| Task completion rate | ≥ 85% | Successful `done` actions / total tasks |
| Step efficiency | ≤ 8 avg steps | Mean steps to completion |
| Error recovery rate | ≥ 60% | Recovered actions / total failures |
| Screenshot reasoning accuracy | ≥ 75% | Correct selector from vision / total vision calls |
| Avg task latency | < 30s | End-to-end including all page loads |

## Human Oversight Triggers

Escalate to human when any of these fire — never proceed autonomously:
- Login or CAPTCHA detected (page contains password field or CAPTCHA iframe)
- Agent stuck: 3 consecutive failed actions on same page
- Domain not in allowlist and agent cannot find alternative
- Sensitive data detected on page (PII, financial, medical)
- `max_steps` reached without task completion
- Page shows payment/checkout flow

## Anti-Patterns

- ❌ Reusing browser context across tasks — leaks state and cookies between sessions
- ❌ Raw HTML as LLM context — bloated tokens, use accessibility tree instead
- ❌ No action step limit — agents loop forever burning tokens
- ❌ Entering credentials into forms — browser agent must never type passwords
- ❌ Skipping domain allowlist checks — agent navigates to arbitrary sites
- ❌ `page.wait_for_timeout(5000)` instead of explicit wait conditions
- ❌ Full-page screenshots at high resolution — use viewport-only at `detail: "low"`
- ❌ No `robots.txt` check before crawling — violates site ToS and gets IP-banned

## WAF Alignment

| Pillar | Browser Agent Application |
| --- | --- |
| **Security** | Domain allowlist, no credential entry, isolated contexts, sandbox enforcement, Content Safety on extracted text |
| **Reliability** | Retry with screenshot fallback, error recovery loop, session timeout kills, graceful degradation to human |
| **Cost** | Accessibility tree over raw HTML (80% fewer tokens), `detail: "low"` screenshots, step limits, gpt-4o-mini for simple navigation |
| **Operational Excellence** | JSON-logged action traces, step-by-step audit trail, correlation IDs per task, evaluation pipeline |
| **Performance** | Parallel context pool, polite rate limiting, `domcontentloaded` over `networkidle`, viewport-only screenshots |
| **Responsible AI** | Human escalation on sensitive data, no autonomous login, PII detection before extraction, CAPTCHA bypass prohibited |
