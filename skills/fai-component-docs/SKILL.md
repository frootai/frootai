---
name: fai-component-docs
description: |
  Create component documentation with props/events contracts, usage examples,
  accessibility notes, and visual state catalog. Use when documenting React,
  Vue, or Web Component libraries.
---

# Component Documentation

Document UI components with props, events, examples, and accessibility.

## When to Use

- Documenting a component library (React, Vue, Angular)
- Creating a design system reference
- Writing usage examples for other developers
- Ensuring accessibility compliance documentation

---

## Component Doc Template

```markdown
# ComponentName

Brief description of what this component does.

## Props

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| title | string | — | Yes | Display title |
| variant | 'primary' ∣ 'secondary' | 'primary' | No | Visual style |
| onSubmit | (data: FormData) => void | — | Yes | Form submit handler |
| disabled | boolean | false | No | Disables interaction |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| onChange | { value: string } | Fired when input changes |
| onError | { message: string } | Fired on validation error |

## Usage

    <Button variant="primary" onClick={handleClick}>Submit</Button>

## Accessibility

- Role: `button`
- Keyboard: Enter/Space activates
- Focus: Visible focus ring on tab
- Screen reader: Label from children text
```

## Auto-Generation from TypeScript

```python
def extract_props(component_path: str) -> list[dict]:
    """Extract props from TypeScript interface."""
    # Parse .tsx file, find Props interface, extract fields
    # Return structured prop definitions
    pass
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Props table incomplete | Missing from source | Lint for undocumented props |
| Examples don't work | Stale imports | Test examples in CI |
| Missing a11y notes | Not part of workflow | Add a11y section to doc template |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment


## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
