# Policy Templates (V7.3)

> **10 hand-crafted `policy.yaml` reference templates** for the V7 Policy
> Overlay Engine. Every file validates against
> [`frootai/schemas/policy.schema.json`](../../schemas/policy.schema.json)
> (V7.1) and is pinned by the V7.3 pytest contract — a schema change that
> breaks any template surfaces in CI.

## Templates

| Slug | Archetype | Network posture | CMK | IaC | Cost band |
|---|---|---|---|---|---|
| [`startup-eu.yaml`](startup-eu.yaml) | Early-stage EU startup (Berlin / Paris / Stockholm) | hybrid | off | bicep | small |
| [`startup-us.yaml`](startup-us.yaml) | Early-stage US startup (SF / NYC / Austin) | hybrid | off | bicep | medium |
| [`mid-market-eu.yaml`](mid-market-eu.yaml) | Mid-market EU enterprise (500–5000 employees) | private | on | both | large |
| [`regulated-eu-finserv.yaml`](regulated-eu-finserv.yaml) | DORA / PSD2 / GDPR EU bank or fintech | private | on | bicep | large |
| [`regulated-eu-healthcare.yaml`](regulated-eu-healthcare.yaml) | GDPR Art.9 / MDR / NIS2 hospital / pharma | private | on | bicep | medium |
| [`us-defense.yaml`](us-defense.yaml) | FedRAMP-High / DoD IL5 (Azure Government) | private | on | both | xl |
| [`apac-bigtech.yaml`](apac-bigtech.yaml) | APAC big-tech / global hyperscaler | hybrid | on | both | xl |
| [`gcp-only.yaml`](gcp-only.yaml) | GCP-first shop using Azure for one workload | hybrid | off | terraform | medium |
| [`cost-conscious.yaml`](cost-conscious.yaml) | Aggressive cost-optimisation overlay | public | off | bicep | micro |
| [`sustainability-first.yaml`](sustainability-first.yaml) | Carbon-conscious / SBTi-pinned overlay | hybrid | off | bicep | small |

## How to use

```yaml
# Copy one of the templates into your repo, rename to your-company.yaml,
# and edit company / regions / tags to fit. Validate via the V7.4 loader
# (lands later in Phase V7); for now the V7.1 schema is the contract.
```

The 10 templates collectively exercise every V7.1 overlay domain at least
once: every enum value of `network.posture` (`public` / `hybrid` / `private`),
every `iac.format` (`bicep` / `terraform` / `both`), every `cost.band_target`
(`micro` / `small` / `medium` / `large` / `xl`), every `naming.separator`
(`-` / `_` / `""`), every `guest_account_policy`, every `role_assignment_policy`,
all 5 `identity.providers`, custom_checks on 4 templates.

## Doctrine

- **Templates are LIVING examples, not stubs**: each represents a realistic
  enterprise archetype with thought put into which overlays the
  archetype's compliance + cost + identity profile would actually pin.
- **Schema is the gate**: V7.3 ships YAML only; semantic enforcement lives in
  the V7.4–V7.18 overlay functions. A template that the V7.1 schema rejects
  is broken on arrival — the leaf test catches it.
- **Cross-template enum coverage** is a tested invariant — picking up a new
  enum value at V7.1 without adding a representative template that exercises
  it surfaces as a coverage gap.

## Regeneration

These templates are NOT auto-generated (unlike the V7.2 reference doc) —
they're hand-curated archetypes. Update by editing in place; the V7.3
pytest contract will catch any schema-validation regression.
