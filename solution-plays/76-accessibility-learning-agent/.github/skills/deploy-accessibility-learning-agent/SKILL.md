---
name: "deploy-accessibility-learning-agent"
description: "Deploy Accessibility Learning Agent — WCAG 2.2 compliance checking, alt-text generation, cognitive load assessment, screen reader optimization, inclusive design recommendations."
---

# Deploy Accessibility Learning Agent

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Node.js 20+ (axe-core integration)
- Python 3.11+ with `azure-openai`, `playwright` (page crawling)

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-accessibility \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Cognitive analysis + alt-text generation (gpt-4o) | S0 |
| Azure OpenAI (Vision) | Image analysis for alt-text (gpt-4o with vision) | S0 |
| Cosmos DB | Audit history, remediation tracking | Serverless |
| Azure Storage | Page snapshots, report PDFs | Standard LRS |
| Container Apps | Accessibility audit API | Consumption |
| Azure Key Vault | API keys | Standard |
| App Insights | Audit telemetry + issue tracking | Pay-as-you-go |

## Step 2: Deploy Automated WCAG Checker (axe-core)

```python
from playwright.async_api import async_playwright

async def run_axe_audit(url: str) -> dict:
    """Run axe-core automated WCAG 2.2 checks."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle")
        
        # Inject axe-core
        await page.add_script_tag(url="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.0/axe.min.js")
        
        # Run with WCAG 2.2 AA ruleset
        results = await page.evaluate("""
            async () => {
                const results = await axe.run(document, {
                    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] }
                });
                return results;
            }
        """)
        await browser.close()
    return results
```

WCAG 2.2 AA check categories:
| Category | Checks | Examples |
|----------|--------|---------|
| **Perceivable** | Alt text, captions, color contrast, text resize | Missing alt, contrast < 4.5:1 |
| **Operable** | Keyboard nav, focus indicators, timing, seizures | No focus visible, keyboard traps |
| **Understandable** | Language, predictability, input assistance | Missing form labels, no error messages |
| **Robust** | Valid HTML, ARIA, name/role/value | Invalid ARIA roles, duplicate IDs |

## Step 3: Deploy AI-Enhanced Checker

```python
AI_ACCESSIBILITY_CHECKS = {
    "alt_text_quality": {
        "description": "Check if alt text is meaningful (not just 'image' or filename)",
        "bad_patterns": ["image", "img_", "photo", "picture", "screenshot", "IMG_"],
        "good_example": "Bar chart showing Q3 revenue growth of 15% compared to Q2"
    },
    "reading_order": {
        "description": "Verify logical reading order matches visual layout",
        "method": "Compare DOM order with visual layout via bounding boxes"
    },
    "cognitive_load": {
        "description": "Assess page complexity for users with cognitive disabilities",
        "factors": ["word_count", "sentence_complexity", "navigation_depth", 
                    "form_field_count", "animation_count", "color_usage"]
    },
    "plain_language": {
        "description": "Check reading level (target: Grade 8 or below)",
        "methods": ["flesch_kincaid", "gunning_fog"],
        "target_grade": 8
    },
    "consistent_navigation": {
        "description": "Navigation appears in same order across pages",
        "method": "Compare nav element order across crawled pages"
    },
    "focus_management": {
        "description": "Modal/dialog focus trapping and restoration",
        "method": "Simulate keyboard interaction, verify focus moves correctly"
    }
}
```

## Step 4: Deploy Alt-Text Generator

```python
async def generate_alt_text(image_url: str, context: str) -> str:
    """Generate meaningful alt text using GPT-4o with vision."""
    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "system",
            "content": """Generate concise, descriptive alt text for this image.
Rules:
1. Describe the PURPOSE of the image in its context, not just what it shows
2. For charts/graphs: include the key data point or trend
3. For decorative images: return empty string (role="presentation")
4. For logos: "Company Name logo"
5. Max 125 characters (screen reader best practice)
6. Don't start with "Image of" or "Picture of"
7. Include text that appears in the image"""
        }, {
            "role": "user",
            "content": [
                {"type": "text", "text": f"Page context: {context}"},
                {"type": "image_url", "image_url": {"url": image_url}}
            ]
        }],
        max_tokens=100
    )
    return response.choices[0].message.content.strip()
```

## Step 5: Deploy Remediation Recommender

```python
REMEDIATION_TEMPLATES = {
    "missing_alt": {
        "severity": "critical",
        "wcag": "1.1.1",
        "fix": 'Add alt="{generated_alt}" to <img> element',
        "effort": "low"
    },
    "low_contrast": {
        "severity": "serious",
        "wcag": "1.4.3",
        "fix": "Change foreground to {suggested_color} (contrast ratio: {ratio}:1)",
        "effort": "low"
    },
    "missing_label": {
        "severity": "critical",
        "wcag": "1.3.1",
        "fix": 'Add <label for="{input_id}"> or aria-label="{text}"',
        "effort": "low"
    },
    "keyboard_trap": {
        "severity": "critical",
        "wcag": "2.1.2",
        "fix": "Add Escape key handler to close modal and restore focus",
        "effort": "medium"
    },
    "no_skip_nav": {
        "severity": "serious",
        "wcag": "2.4.1",
        "fix": 'Add <a href="#main-content" class="skip-link">Skip to content</a>',
        "effort": "low"
    }
}
```

## Step 6: Smoke Test

```bash
# Audit a URL
curl -s https://api-a11y.azurewebsites.net/api/audit \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url": "https://example.com", "wcag_level": "AA"}' | jq '.summary'

# Generate alt text for an image
curl -s https://api-a11y.azurewebsites.net/api/alt-text \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"image_url": "https://example.com/chart.png", "context": "Q3 revenue report"}' | jq '.alt_text'

# Get remediation recommendations
curl -s https://api-a11y.azurewebsites.net/api/remediate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"audit_id": "..."}' | jq '.recommendations[:3]'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| axe-core finds 0 issues | SPA not fully rendered | Wait for `networkidle` or add custom wait |
| Alt text too generic | No page context provided | Pass surrounding text as context |
| High false positive rate | axe-core defaults too strict | Filter by impact level (critical + serious only) |
| Playwright timeout | Slow page load | Increase timeout, add retry |
| Cognitive load always high | Threshold too strict | Calibrate per content type (docs vs apps) |
