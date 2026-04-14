---
description: "Shell scripting standards — set -euo pipefail, safe expansions, quoting, and portable POSIX patterns."
applyTo: "**/*.sh"
waf:
  - "security"
  - "reliability"
---

# Shell Scripting — FAI Standards

## Strict Mode

Every bash script starts with strict mode. No exceptions.

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

- `set -e` — exit on first non-zero return (use `|| true` for intentional failures)
- `set -u` — treat unset variables as errors (catches typos like `$VERISON`)
- `set -o pipefail` — propagate failures through pipes (`curl | jq` fails if curl fails)
- `IFS=$'\n\t'` — prevent word splitting on spaces in `for` loops over filenames

## ShellCheck & shfmt

Integrate static analysis into CI. ShellCheck catches quoting bugs, unreachable code, and POSIX issues.

```bash
# CI pipeline — lint all scripts
shellcheck --severity=warning scripts/**/*.sh
shfmt -d -i 2 -ci -bn scripts/**/*.sh  # diff mode, 2-space indent, case indent, binary next-line
```

Suppress only with inline directives and justification:
```bash
# shellcheck disable=SC2034  # Variable used by sourcing script
EXPORTED_CONFIG="${config_path}"
```

## Quoting

Always double-quote variable expansions. Unquoted variables cause word splitting and glob expansion.

```bash
# Correct
cp "${source_dir}/file.txt" "${dest_dir}/"
if [[ -n "${MY_VAR:-}" ]]; then  # :-  provides default for set -u
  echo "Value: ${MY_VAR}"
fi

# Wrong — breaks on paths with spaces, expands globs
cp $source_dir/file.txt $dest_dir/
```

Use `"$@"` to forward arguments (preserves quoting). Never use `$*` unquoted.

## Arrays Over Word Splitting

Use bash arrays instead of space-delimited strings for lists.

```bash
declare -a files=("report 2024.csv" "data (final).json" "notes.txt")
for f in "${files[@]}"; do
  process_file "${f}"
done

# Build command arrays for complex invocations
declare -a curl_opts=(--silent --fail --retry 3 --max-time 30)
curl "${curl_opts[@]}" "${api_url}"
```

## Functions

Use `local` for all variables inside functions. Return exit codes, not strings via `return`.

```bash
validate_input() {
  local input="${1:?validate_input requires an argument}"
  local max_length="${2:-255}"

  if [[ ${#input} -gt "${max_length}" ]]; then
    log_error "Input exceeds ${max_length} chars"
    return 1
  fi
  [[ "${input}" =~ ^[a-zA-Z0-9_-]+$ ]] || return 1
}

# Capture output with command substitution
get_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}
local ts
ts="$(get_timestamp)"
```

## Error Handling & Cleanup

Use `trap` for cleanup on EXIT and error reporting on ERR.

```bash
cleanup() {
  local exit_code=$?
  rm -rf "${TMPDIR:-}"
  if [[ ${exit_code} -ne 0 ]]; then
    log_error "Script failed with exit code ${exit_code}"
  fi
  exit "${exit_code}"
}
trap cleanup EXIT

on_error() {
  local line=$1 cmd=$2
  log_error "FAILED: line ${line}: ${cmd}"
}
trap 'on_error ${LINENO} "${BASH_COMMAND}"' ERR
```

## Temp Files

Always use `mktemp`. Never hardcode `/tmp/myscript.tmp` (race conditions, symlink attacks).

```bash
TMPDIR="$(mktemp -d)" || { echo "mktemp failed" >&2; exit 1; }
readonly TMPDIR
# cleanup trap (above) handles removal
intermediate="${TMPDIR}/results.json"
```

## Logging

Diagnostics to stderr, data to stdout. This lets callers pipe output without log noise.

```bash
log_info()  { echo "[INFO]  $(date -u +%H:%M:%S) $*" >&2; }
log_error() { echo "[ERROR] $(date -u +%H:%M:%S) $*" >&2; }
log_debug() { [[ "${DEBUG:-0}" == "1" ]] && echo "[DEBUG] $(date -u +%H:%M:%S) $*" >&2 || true; }

# Data goes to stdout — pipeable
generate_report() {
  log_info "Generating report for ${project}"
  jq '.results' "${TMPDIR}/data.json"  # stdout = data
}
```

## Argument Parsing

Use `getopts` for simple flags, manual `while/case/shift` for long options.

```bash
usage() { echo "Usage: $0 -e <env> -r <region> [-v] [-h]" >&2; exit 1; }

verbose=0 env="" region=""
while getopts ":e:r:vh" opt; do
  case "${opt}" in
    e) env="${OPTARG}" ;;
    r) region="${OPTARG}" ;;
    v) verbose=1 ;;
    h) usage ;;
    :) log_error "Option -${OPTARG} requires argument"; usage ;;
    *) log_error "Unknown option -${OPTARG}"; usage ;;
  esac
done
shift $((OPTIND - 1))
[[ -z "${env}" ]] && { log_error "-e <env> is required"; usage; }
```

## Portable Syntax

Know when you need bash vs POSIX sh. Use `#!/usr/bin/env bash` for bash features, `#!/bin/sh` for portability.

| Feature | Bash | POSIX sh |
|---|---|---|
| `[[ ]]` tests | ✅ | ❌ use `[ ]` |
| Arrays | ✅ | ❌ |
| `local` keyword | ✅ | ❌ (but widely supported) |
| `$(( ))` arithmetic | ✅ | ✅ |
| `$( )` substitution | ✅ | ✅ |
| Process substitution `<()` | ✅ | ❌ |

## Subprocess Management

Use `wait` to collect exit codes. Avoid orphan processes.

```bash
pids=()
for shard in "${shards[@]}"; do
  process_shard "${shard}" &
  pids+=($!)
done
for pid in "${pids[@]}"; do
  wait "${pid}" || { log_error "Shard PID ${pid} failed"; exit 1; }
done
```

## Testing with bats-core

```bash
# test/deploy.bats
@test "validate_input rejects special characters" {
  run validate_input "rm -rf /"
  [ "$status" -eq 1 ]
}

@test "get_timestamp returns ISO format" {
  run get_timestamp
  [[ "$output" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]
}
```

Run: `bats test/` in CI alongside shellcheck.

## Anti-Patterns

- ❌ `eval "${user_input}"` — command injection vector, use arrays instead
- ❌ `curl ... | bash` — unverified remote code execution
- ❌ Unquoted `$var` in `[ ]` or command args — word splitting, glob expansion
- ❌ `cd dir && ... || ...` without subshell — pollutes working directory
- ❌ `cat file | grep` — useless use of cat, use `grep pattern file`
- ❌ Parsing `ls` output — breaks on whitespace/newlines, use `find` or globs
- ❌ `rm -rf "${DIR}/"` when `DIR` could be empty — deletes `/`
- ❌ Storing secrets in script variables — use env vars from vault, `read -rs`
- ❌ `#!/bin/bash` hardcoded path — use `#!/usr/bin/env bash` for portability
- ❌ `test -f` on user-supplied path without sanitization — path traversal

## WAF Alignment

| Pillar | Shell Practice |
|---|---|
| **Security** | Never `eval` user input. No `curl\|bash`. Validate/sanitize all external input. Use `mktemp` (no predictable paths). Secrets via env vars from Key Vault, never in scripts. `umask 077` for sensitive file creation. |
| **Reliability** | `set -euo pipefail` in every script. `trap cleanup EXIT`. Retry loops with backoff for network calls. `wait` on all background PIDs. Idempotent operations (create-if-not-exists). |
| **Cost Optimization** | Exit early on precondition failure (avoid billable API calls). Cache intermediate results in temp files. Batch API calls instead of per-item loops. |
| **Operational Excellence** | ShellCheck + shfmt in CI. Structured logging to stderr. bats-core test suites. `--dry-run` flag for destructive operations. Consistent exit codes (0=success, 1=error, 2=usage). |
| **Performance** | Parallel subprocess execution with `wait`. Prefer built-in string ops over `sed`/`awk` for simple transforms. Stream large files instead of loading into variables. |
| **Responsible AI** | Sanitize prompts piped to LLM APIs. Redact PII from log output. Never log full API responses containing user data. |
