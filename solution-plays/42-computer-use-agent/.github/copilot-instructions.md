---
description: "Computer Use Agent domain knowledge — auto-injected into every Copilot conversation"
applyTo: "**"
---

# Computer Use Agent — Domain Knowledge

This workspace implements a computer use agent — AI that interacts with desktop applications via screenshots, mouse/keyboard actions, and accessibility APIs to automate complex workflows across any application.

## Computer Use Architecture (What the Model Gets Wrong)

### Screenshot → Reason → Act Loop
```python
async def computer_use_loop(task: str, max_steps: int = 20):
    for step in range(max_steps):
        # 1. Capture screen state
        screenshot = capture_screenshot()  # PIL Image
        
        # 2. Send to vision model with task context
        action = await decide_action(
            model="gpt-4o",
            screenshot=screenshot,
            task=task,
            history=action_history[-5:],  # Last 5 actions for context
        )
        
        # 3. Execute action
        match action.type:
            case "click": pyautogui.click(action.x, action.y)
            case "type": pyautogui.typewrite(action.text, interval=0.05)
            case "hotkey": pyautogui.hotkey(*action.keys)  # Ctrl+C, Alt+Tab
            case "scroll": pyautogui.scroll(action.amount)
            case "wait": await asyncio.sleep(action.seconds)
            case "done": return action.result
        
        # 4. Wait for UI to settle
        await asyncio.sleep(0.5)
        action_history.append(action)
```

### Accessibility API vs Screenshots
| Approach | Pros | Cons | When to Use |
|----------|------|------|------------|
| Screenshots + Vision | Works on any app, no API needed | Expensive (tokens), slower, brittle coordinates | Legacy apps without accessibility |
| Accessibility API | Fast, structured, reliable selectors | Not all apps expose accessibility tree | Modern apps with MSAA/UIA support |
| Hybrid | Best of both | More complex implementation | Production systems |

### Key Pitfalls
| Mistake | Why Wrong | Fix |
|---------|----------|-----|
| Full-resolution screenshots | Token cost explosion (4K screenshot = 2000+ tokens) | Resize to 1280x720 max |
| No action history | Agent repeats failed actions | Track last 5 actions, detect loops |
| No coordinate validation | Clicks outside screen bounds | Validate x,y within screen dimensions |
| No wait after actions | UI hasn't updated yet | Wait 0.5-1s after each action, verify state changed |
| Hardcoded coordinates | Break on different resolutions | Use relative coordinates or accessibility selectors |
| No sandbox/VM | Agent has full system access | Run in VM or sandbox with limited permissions |
| No max step limit | Agent loops forever | Max 20 steps, then report failure |
| No undo capability | Destructive action can't be reversed | Confirm destructive actions, snapshot before |

## Config Files (TuneKit)
| File | What to Tune |
|------|-------------|
| `config/openai.json` | Vision model, screenshot detail level, max_tokens |
| `config/guardrails.json` | Max steps, allowed apps, blocked actions, sandbox settings |
| `config/agents.json` | Screenshot resolution, wait times, action timeout |

## Available Specialist Agents (optional)
| Agent | Use For |
|-------|---------|
| `@builder` | Implement screenshot loop, accessibility integration, action execution |
| `@reviewer` | Audit security (sandbox, permissions), action safety, loop detection |
| `@tuner` | Optimize screenshot resolution, action reliability, step efficiency |

## Slash Commands
`/deploy` — Deploy agent | `/test` — Test automation flows | `/review` — Audit safety | `/evaluate` — Measure task completion
