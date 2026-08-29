# FrootAI CLI Security Model

## Security boundary

The CLI runs with the invoking user's operating-system permissions. It does not
provide a sandbox. Treat installed plugins, generated infrastructure, release
credentials, and repository scripts as privileged code.

## Protected assets

- npm release artifacts, integrity, and registry signatures
- repository tags and version files
- cloud and registry credentials
- harvested source and generated infrastructure
- local authentication tokens and operation audit records

## Trust boundaries

1. Terminal input to the CLI command router.
2. CLI policy decision to child release scripts.
3. Local workspace to external registries, GitHub, cloud APIs, and CDNs.
4. Source checkout to packed npm tarball.
5. Tested artifact to protected production publication.

## Destructive-operation policy

External mutation is denied unless explicitly approved:

```text
frootai ship cli patch --confirm-external
frootai engine commit ./play --upgrade-to-play --confirm-external
frootai update --apply --yes --confirm-external
```

An external mutation using `--force` also requires `--confirm-force`. In CI,
the audited CLI invocation requires `CI=true` and
`FROOTAI_APPROVE_EXTERNAL=1`; forced mutation additionally requires
`FROOTAI_APPROVE_FORCE=1`.

Approval flags are consumed by the router and never forwarded to business
handlers. The CLI creates a random one-time token, stores only its SHA-256 hash
in the audit record, and passes the secret to child release scripts through the
process environment. A child authorization is valid for five minutes, must
match the requested operation, and cannot be reused after completion.

Direct non-dry-run execution of `scripts/factory/ship.js` or
`scripts/release-channel.js` is denied.

## Audit log

Mutating operations produce owner-only JSONL records at
`~/.frootai/audit/operations.jsonl` unless `FROOTAI_AUDIT_LOG` overrides the
path. Records contain command flags, not positional values or paths. Every
record hashes the previous record and its canonical body.

```text
frootai audit verify
frootai audit tail 20
frootai audit path
```

The local hash chain detects accidental or partial tampering. It is not remote
non-repudiation: an attacker who controls the account and can replace the whole
file can recompute it. Production operators must export audit events to their
central immutable log platform and alert on chain discontinuity.

## Supply-chain controls

`cli/scripts/enterprise-gate.js`:

- packs the release once
- rejects lifecycle scripts
- enforces packed and unpacked size budgets
- installs the tarball in an isolated prefix with scripts disabled
- runs commands from the packed artifact
- enforces per-command and aggregate startup budgets
- verifies capability and product schemas
- verifies destructive denial and the audit chain
- proves there are zero runtime npm dependencies
- requires a zero-vulnerability npm advisory result
- emits tarball SHA-256, SHA-512, npm integrity, and inventory digest
- emits fail-closed release evidence bound to the source revision

The release workflow retains the tarball and checksum-bound release evidence as
one artifact, publishes that exact tarball only after an explicit tag-bound
workflow dispatch, and compares npm registry integrity with the tested evidence.
GitHub artifact attestations and npm provenance are not claimed because they are
unavailable for this private repository on the current organization plan.

## Credential handling

- Token and credential files use owner-only mode `0600` on POSIX.
- Writes are atomic where supported.
- Audit and diagnostic output redacts tokens and positional command values.
- CI checkout credentials are not persisted.
- npm publication uses the repository automation token only after explicit
  immutable-tag confirmation; local developer publication is not used.

## Vulnerability reporting

Do not open public issues for suspected vulnerabilities. Follow the private
reporting process in the repository-level `SECURITY.md`.