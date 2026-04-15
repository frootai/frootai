---
name: fai-excalidraw-generator
description: |
  Generate architecture and workflow diagrams in Excalidraw JSON format with
  consistent notation, color coding, and exportable layouts. Use when creating
  visual documentation that can be edited collaboratively.
---

# Excalidraw Diagram Generator

Generate editable architecture diagrams in Excalidraw format.

## When to Use

- Creating architecture diagrams that teams can edit
- Generating visual documentation from code or config
- Building consistent diagram notation across projects
- Exporting diagrams for presentations or docs

---

## Excalidraw JSON Structure

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [
    {
      "type": "rectangle",
      "x": 100, "y": 100, "width": 200, "height": 80,
      "backgroundColor": "#a5d8ff",
      "strokeColor": "#1971c2",
      "label": { "text": "API Gateway" }
    },
    {
      "type": "arrow",
      "x": 300, "y": 140,
      "points": [[0, 0], [150, 0]],
      "strokeColor": "#495057",
      "label": { "text": "HTTPS" }
    },
    {
      "type": "rectangle",
      "x": 450, "y": 100, "width": 200, "height": 80,
      "backgroundColor": "#b2f2bb",
      "strokeColor": "#2f9e44",
      "label": { "text": "Azure OpenAI" }
    }
  ]
}
```

## Generation from Architecture

```python
def generate_excalidraw(services: list[dict], connections: list[dict]) -> dict:
    elements = []
    positions = {}
    x, y = 100, 100

    for svc in services:
        elements.append({
            "type": "rectangle", "x": x, "y": y,
            "width": 200, "height": 80,
            "backgroundColor": svc.get("color", "#a5d8ff"),
            "label": {"text": svc["name"]},
        })
        positions[svc["name"]] = (x + 200, y + 40)
        x += 300

    for conn in connections:
        src = positions[conn["from"]]
        dst = positions[conn["to"]]
        elements.append({
            "type": "arrow",
            "x": src[0], "y": src[1],
            "points": [[0, 0], [dst[0]-src[0], dst[1]-src[1]]],
            "label": {"text": conn.get("label", "")},
        })

    return {"type": "excalidraw", "version": 2, "elements": elements}
```

## Color Coding Convention

| Category | Color | Hex |
|----------|-------|-----|
| Compute | Blue | #a5d8ff |
| AI/ML | Green | #b2f2bb |
| Data | Yellow | #ffec99 |
| Security | Red | #ffc9c9 |
| Network | Gray | #dee2e6 |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Elements overlap | Fixed x/y positions | Use auto-layout algorithm |
| Arrows misaligned | Wrong source/target points | Calculate from element center |
| Large diagrams unreadable | Too many elements | Group by domain, use frames |
