# Public Repository Scope

This document defines the durable contribution and publication boundary for `frootai/frootai`.

## Purpose

The public repository exists to make the FAI Protocol inspectable, portable, and useful across vendors and delivery surfaces. It is the canonical public home for standards, community content, examples, and compatibility evidence—not the canonical source for proprietary distribution or hosted-service implementation.

## Public and contribution-ready

The following material belongs in this repository when it contains no credentials, customer data, private configuration, or proprietary implementation dependency:

- FAI Protocol specifications and design records intended for adoption.
- JSON schemas, examples, conformance fixtures, and compatibility results.
- Agents, instructions, skills, hooks, prompts, and agentic workflow definitions released for community use.
- Solution Plays, architecture documents, reference infrastructure, evaluation fixtures, and safe sample configuration.
- Community plugin descriptors and installable content bundles.
- Orchard public schemas, registry records, trust evidence, and community submissions.
- Documentation, cookbook recipes, workshops, tutorials, and public website metadata.
- Governance, security, support, contribution, legal, and community policies.
- Public API contracts, type declarations, package metadata, and generated catalogs required by consumers.
- CI that validates public contracts and community contributions without containing private release machinery.

## Controlled implementation boundary

The following categories are maintained through controlled private engineering and release systems unless the founder explicitly approves an implementation as open source:

- VS Code extension implementation and release automation.
- CLI command implementation, authentication, update, signing, and release logic.
- Hosted Agent FAI, Cloud APIs, webhook handlers, control planes, and production infrastructure.
- FAI Engine execution internals and private orchestration.
- Factory harvesting, transformation, generation, classification, and distribution internals.
- Plugin execution engines, materializers, commercial validators, and private marketplace operations.
- Unpublished SDKs, package source, private adapters, and release credentials or configuration.
- Repository synchronization policy and private/public classification machinery.

Published VSIX, npm, PyPI, container, and other client artifacts remain publicly inspectable by design. Security-sensitive and differentiating behavior should therefore remain server-side wherever practical.

## Transitional content

Historical or transitional implementation directories may remain temporarily while dependency and release continuity are being audited. Their presence does not make them the canonical release source.

A path may be removed only after all of the following are true:

1. Its private canonical source is verified and recoverable.
2. Every build, workflow, package, documentation, and runtime consumer is identified.
3. Public consumers have a stable contract, generated artifact, or documented replacement.
4. Clean-environment builds and release channels pass without the public implementation.
5. Historical tags, artifacts, links, and support obligations are addressed separately.
6. The founder approves the exact migration scope.

## Pull-request rule

New pull requests must not introduce controlled implementation categories into the public repository. If classification is uncertain, stop and request a repository-boundary review before committing the material.
