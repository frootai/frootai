# FrootAI CLI Enterprise Operations

## Required GitHub configuration

The repository administrator must configure all of the following before a GA
release:

1. Upgrade the organization plan or make the repository public before claiming
   GitHub branch protection, protected environments, artifact attestations, or
   npm provenance.
2. Until then, restrict `main` merges and `cli-v*` tag creation operationally
   to designated release managers and require reviewed pull requests.
3. Keep the repository `NPM_TOKEN` scoped to the `frootai` package, automation
   only, and rotate it under the organization's credential policy.
4. Configure CODEOWNERS approval for `cli/**`, release workflows, and release
   scripts when the hosted plan supports enforcement.
5. Retain workflow artifacts and logs according to the evidence-retention policy.

The repository cannot enforce these hosted settings from source code. A release
is not enterprise-approved until an administrator has captured evidence that
the settings are active.

## Release procedure

1. Start from a clean, reviewed, protected branch revision.
2. Run `npm run cli:test:enterprise`.
3. Run `npm run cli:gate:enterprise`; online advisory access is mandatory.
4. Review `enterprise-release-evidence.json`; every gate must pass.
5. Create the authorized `cli-vX.Y.Z` tag at the reviewed revision.
6. Confirm the tag-push gate succeeds and retains its checksum-bound evidence.
7. Dispatch `Publish CLI (enterprise gate)` on the immutable release tag with
   `publish=true` and confirmation `publish frootai@X.Y.Z`.
8. Confirm the workflow publishes the same tarball digest recorded in evidence.
9. Confirm npm's registry integrity and registry signature, then run smoke tests
   from a clean machine with no source checkout.

`--offline` exists only for local development where advisory service access is
unavailable. Offline evidence must never authorize production publication.

## Release SLOs

- Release artifact integrity mismatch: zero tolerance; block or incident.
- Critical/high production dependency vulnerabilities: zero tolerance.
- Destructive command without explicit approval: zero tolerance.
- Audit-chain verification failure: zero tolerance for release operations.
- Packed CLI command smoke success: 100% on Linux, macOS, and Windows across
  supported Node versions.
- Packed read-command startup: each smoke command within 10 seconds and the
   nine-command gate within 45 seconds on a standard hosted runner.
- Rollback decision after confirmed release regression: within 30 minutes.

## Rollback and incident response

npm packages are immutable. Do not overwrite or unpublish an enterprise
release except under npm's emergency policy.

1. Stop deployments and disable the production environment temporarily.
2. Deprecate the affected version with a precise warning.
3. Move the npm `latest` tag to the last verified version when compatible.
4. Preserve the workflow run, evidence, audit chain, and registry
   metadata.
5. Rotate credentials if exposure is possible.
6. Publish a fixed patch through the complete enterprise gate.
7. Record timeline, impact, root cause, and corrective actions.

## Disaster recovery

- Source of truth: protected Git revision and immutable npm package.
- Evidence: retained workflow artifact, SHA-256/SHA-512 digests, npm integrity
   and registry signature, and enterprise evidence JSON.
- Recovery test: quarterly installation and verification of the latest package
  from a clean runner in every supported operating-system family.
- Audit backup: export local mutation logs to organization-controlled immutable
  storage before retention or workstation replacement.

## Residual risks

- The CLI inherits the permissions of the invoking user.
- Repository-bound Factory commands are not standalone and require a trusted
  checkout.
- Local audit chains are tamper-evident, not independently signed.
- External MCP servers and generated infrastructure have separate trust and
  authorization boundaries.
- Hosted branch protection, environments, GitHub attestations, and npm
   provenance are unavailable on the current private-repository plan. This is a
   documented residual governance risk until the plan is upgraded or source is public.