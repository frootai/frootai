---
description: "Power Platform solution lifecycle rules"
applyTo: "solution/**,config/**,spec/**,.github/**"
---

# Power Platform ALM

1. Author in an owned development environment.
2. Export unmanaged source and unpack it under `solution/`.
3. Keep connection references symbolic and environment variables value-free.
4. Run solution structure and policy checks before creating a managed artifact.
5. Import the managed artifact into an isolated test environment.
6. Bind tests, approval, production import, smoke, and rollback to one artifact.
7. Fail closed when environment authority or evidence is missing.

Never edit a managed export as source, commit credentials, reuse development
connections in production, or rebuild a different artifact between stages.