---
name: "tune-computer-use-agent"
description: "Tune Computer Use Agent configuration — screenshot resolution, vision detail level, action timing, loop detection, coordinate calibration, cost optimization."
---

# Tune Computer Use Agent

## Prerequisites

- Deployed computer use agent with evaluation results available
- Access to `config/openai.json`, `config/guardrails.json`, `config/agents.json`
- Evaluation baseline from `evaluate-computer-use-agent` skill

## Step 1: Tune Screenshot Capture

### Screenshot Resolution
```json
// config/agents.json
{
  "screenshot": {
    "width": 1280,
    "height": 720,
    "format": "png",
    "quality": 85,
    "region": "full_screen",
    "cursor_visible": true,
    "highlight_active_window": false
  },
  "capture_strategy": {
    "mode": "on_change",
    "min_interval_ms": 500,
    "detect_ui_transition": true,
    "crop_to_active_window": false
  }
}
```

Tuning levers:
| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| `width` | 1280 | 640-1920 | Higher = better accuracy, more tokens |
| `height` | 720 | 480-1080 | Higher = better accuracy, more tokens |
| `quality` | 85 | 50-100 | Lower = smaller payload, slight accuracy loss |
| `crop_to_active_window` | false | true/false | true = fewer tokens, miss context outside window |
| `cursor_visible` | true | true/false | true helps agent understand current position |

Token cost by resolution:
| Resolution | Detail | Tokens/Image | Cost/Image |
|-----------|--------|-------------|------------|
| 640×480 | low | 85 | $0.0004 |
| 1280×720 | low | 85 | $0.0004 |
| 1280×720 | high | 765 | $0.004 |
| 1920×1080 | high | 1105 | $0.006 |
| 3840×2160 | high | 2210 | $0.011 |

Recommendation:
- Use `low` detail for navigation/clicking (button positions don't need high res)
- Switch to `high` detail only when reading text or identifying small UI elements
- Crop to active window when task is single-app

## Step 2: Tune Vision Model

### Model Configuration
```json
// config/openai.json
{
  "vision": {
    "model": "gpt-4o",
    "detail": "auto",
    "temperature": 0.1,
    "maxTokens": 300,
    "seed": 42,
    "systemPrompt": "You are a computer use agent. Analyze the screenshot and decide the next action to complete the task. Return JSON: {type, x, y, text, keys, result}."
  },
  "action_planning": {
    "include_history": true,
    "history_length": 5,
    "include_task_progress": true,
    "structured_output": true
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `temperature` | 0.1 | Lower = more deterministic actions, less creative recovery |
| `maxTokens` | 300 | Higher allows more reasoning but costs more |
| `seed` | 42 | Fixed seed = reproducible actions for same screenshot |
| `detail` | auto | "low" saves 80% tokens, "high" for text-heavy UIs |
| `history_length` | 5 | More history = better context, higher token cost |

### Prompt Optimization
```python
# If click accuracy < 90%:
#   - Add grid overlay to screenshots (divide into 12x8 grid)
#   - Ask model to reference grid coordinates first, then pixel coordinates
#   - Example: "Click the Save button at grid (8, 3), pixel (850, 290)"

# If action type accuracy < 92%:
#   - Add explicit action type examples in system prompt
#   - Include "available actions" list with descriptions
#   - Add few-shot examples of common UI interactions

# If step efficiency < 70%:
#   - Enable multi-step planning (plan 3 actions ahead)
#   - Add "current progress" tracking to reduce exploratory steps
```

## Step 3: Tune Action Execution

### Timing Configuration
```json
// config/agents.json — action timing
{
  "actions": {
    "click": {
      "delay_before_ms": 100,
      "delay_after_ms": 500,
      "double_click_interval_ms": 200
    },
    "type": {
      "interval_ms": 30,
      "delay_after_ms": 300,
      "clear_field_first": true
    },
    "hotkey": {
      "delay_between_keys_ms": 50,
      "delay_after_ms": 500
    },
    "scroll": {
      "delay_after_ms": 300,
      "pixels_per_scroll": 120
    },
    "wait": {
      "ui_transition_ms": 1000,
      "page_load_ms": 3000,
      "dialog_appear_ms": 500
    }
  }
}
```

Tuning levers:
| Parameter | Default | When to Adjust |
|-----------|---------|---------------|
| `click.delay_after_ms` | 500 | Increase for slow apps, decrease for fast UIs |
| `type.interval_ms` | 30 | Increase for web forms with validation, decrease for notepad |
| `wait.ui_transition_ms` | 1000 | Increase for heavy apps (Excel, SAP), decrease for lightweight |
| `wait.page_load_ms` | 3000 | Increase for slow websites |
| `type.clear_field_first` | true | false if appending to existing text |

## Step 4: Tune Loop Detection

```json
// config/guardrails.json — loop detection
{
  "loop_detection": {
    "enabled": true,
    "similarity_threshold": 0.95,
    "max_repeated_actions": 3,
    "screenshot_diff_threshold": 0.02,
    "recovery_strategies": [
      "try_alternative_action",
      "scroll_to_find_element",
      "press_escape",
      "alt_tab_reset"
    ]
  },
  "stuck_detection": {
    "max_no_progress_steps": 5,
    "progress_check": "screenshot_diff",
    "on_stuck": "report_and_exit"
  }
}
```

Tuning levers:
| Parameter | Default | Impact |
|-----------|---------|--------|
| `similarity_threshold` | 0.95 | Lower = catch more loops, risk false positives |
| `max_repeated_actions` | 3 | Lower = exit loops faster, may exit valid retries |
| `screenshot_diff_threshold` | 0.02 | Lower = more sensitive to small changes |
| `max_no_progress_steps` | 5 | Lower = fail faster on stuck tasks |

## Step 5: Tune Accessibility Integration

```json
// config/accessibility.json
{
  "mode": "hybrid",
  "use_accessibility_api": true,
  "fallback_to_screenshot": true,
  "accessibility": {
    "framework": "ui-automation",
    "element_cache_ttl_ms": 5000,
    "preferred_locators": ["automationId", "name", "className"],
    "retry_on_stale_element": true
  },
  "hybrid_rules": {
    "prefer_accessibility_for": ["click_button", "fill_form", "read_text"],
    "prefer_screenshot_for": ["navigate", "verify_layout", "check_visual_state"]
  }
}
```

Benefits of hybrid approach:
| Scenario | Method | Why |
|----------|--------|-----|
| Click a button | Accessibility API | Reliable selector, pixel-independent |
| Fill a form field | Accessibility API | Direct value injection, no typing delay |
| Navigate a menu | Screenshot + Vision | Menu visual structure varies widely |
| Verify a table | Screenshot + Vision | Visual layout confirmation |
| Read text from screen | Accessibility API | Faster and more accurate than OCR |

## Step 6: Cost Optimization

```python
# Computer use agent cost breakdown per task:
# - Screenshots: ~$0.004/image (high detail) × 12 steps = $0.048
# - Action planning: ~$0.003/step (300 token response) × 12 = $0.036
# - VM runtime: ~$0.008/min (D4s_v5) × 5 min = $0.040
# - Total: ~$0.12/task

# Cost reduction strategies:
# 1. Use "low" detail for navigation (saves 80% per image)
# 2. Crop to active window (reduces image tokens by 40%)
# 3. Use accessibility API when possible (no vision call needed)
# 4. Deallocate VM when idle (zero cost when not in use)
# 5. Batch tasks to amortize VM startup
```

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Low detail screenshots | ~80% vision cost | Slightly lower text reading accuracy |
| Crop to active window | ~40% vision cost | Miss out-of-window context |
| Accessibility API first | ~60% per action | Not all elements accessible |
| VM auto-deallocate | 100% idle cost | 2-3 min startup time |
| Multi-step planning | ~30% fewer steps | May miss intermediate state changes |
| Cache common UI patterns | ~20% vision calls | May use stale cached data |

## Step 7: Verify Tuning Impact

```bash
# Re-run evaluation after tuning
python evaluation/eval_completion.py --test-data evaluation/data/
python evaluation/eval_actions.py --test-data evaluation/data/
python evaluation/eval_safety.py --test-data evaluation/data/adversarial/
python evaluation/eval_vision.py --test-data evaluation/data/
python evaluation/eval_cost.py --test-data evaluation/data/

# Compare before/after
python evaluation/compare_results.py \
  --baseline evaluation/results/baseline/ \
  --current evaluation/results/ \
  --output evaluation/tuning-impact.md
```

Expected improvements:
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Task completion | baseline | +5-10% | > 85% |
| Click accuracy | baseline | +5-8% | > 90% |
| Step efficiency | baseline | +15-20% | > 70% |
| Cost per task | ~$0.50 | ~$0.12-0.20 | < $0.50 |
| Loop detection | baseline | +5% | > 95% |
