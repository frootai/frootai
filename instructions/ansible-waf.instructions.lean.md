---
description: "Ansible automation standards — idempotent playbooks, secure vault usage, role structure, handler patterns, variable naming, error handling, molecule testing, and CI linting for reliable infrastructure-as-code."
applyTo: "**/*.yml, **/playbooks/**, **/roles/**"
waf:
  - "operational-excellence"
  - "reliability"
  - "security"
---

# Ansible Automation — FAI Standards

When writing or reviewing Ansible playbooks, roles, and inventories, enforce these standards for reliable, secure, and maintainable infrastructure automation.

## Idempotency Rules

1. Every task must be safe to run multiple times without changing the result — this is non-negotiable
2. Use module parameters that enforce desired state (`state: present`, `state: started`) — never rely on shell commands for state management
3. Avoid `command`, `shell`, and `raw` modules unless no native module exists — if used, add `creates` or `removes` guards
4. Use `changed_when` and `failed_when` to accurately report task status

```yaml
# WRONG: not idempotent — runs every time
- name: Create user
  command: useradd deploy

# CORRECT: idempotent module with desired state
- name: Create user
  ansible.builtin.user:
    name: deploy
    state: present
    shell: /bin/bash

# CORRECT: shell with idempotency guard
- name: Initialize database
  ansible.builtin.command: /opt/app/init-db.sh
  args:
    creates: /opt/app/.db-initialized
```

## Variable Naming & Scoping

5. Prefix role variables with the role name to avoid collisions: `nginx_port`, `postgres_max_connections`
6. Use `snake_case` for all variable names — never camelCase or kebab-case
7. Define defaults in `roles/<role>/defaults/main.yml` — override in `group_vars/` or `host_vars/`
8. Never use `set_fact` for values that should be in inventory or defaults — `set_fact` persists for the play and is hard to trace
9. Document every variable in `roles/<role>/README.md` with type, default, and description

```yaml
# roles/nginx/defaults/main.yml
nginx_port: 80
nginx_worker_processes: auto
nginx_ssl_enabled: false
nginx_ssl_certificate: ""
nginx_ssl_key: ""
```

## Vault & Secret Management

10. Encrypt all secrets with `ansible-vault` — passwords, API keys, certificates, tokens
11. Never commit unencrypted secrets — use `ansible-lint` rule `no-plaintext-password` in CI
12. Use a separate vault file per environment: `group_vars/production/vault.yml`, `group_vars/staging/vault.yml`
13. Prefix vault variables with `vault_` and reference them through non-vault variables for clarity
14. Store vault password in CI/CD secret manager — never in the repository or on disk

```yaml
# group_vars/production/vault.yml (encrypted)
vault_db_password: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  ...

# group_vars/production/vars.yml (plaintext reference)
db_password: "{{ vault_db_password }}"
```

## Role Structure

15. Follow the standard Ansible role directory layout — don't invent custom structures

```
roles/nginx/
  defaults/main.yml    # Default variables (lowest precedence)
  handlers/main.yml    # Handler definitions
  meta/main.yml        # Role metadata and dependencies
  tasks/main.yml       # Task entry point
  templates/           # Jinja2 templates
  files/               # Static files
  vars/main.yml        # Role variables (high precedence)
  molecule/            # Test scenarios
  README.md            # Variable docs, usage examples
```

16. Keep `tasks/main.yml` under 50 lines — split into includes: `tasks/install.yml`, `tasks/configure.yml`, `tasks/service.yml`
17. Declare role dependencies in `meta/main.yml` — never assume roles run in a specific order without explicit dependencies

## Handler Patterns

18. Handlers must be named descriptively and prefixed with the role name
19. Use `notify` to trigger handlers — never call handlers directly with `meta: flush_handlers` unless ordering is critical
20. Handlers run once at the end of the play regardless of how many times they're notified

```yaml
# roles/nginx/handlers/main.yml
- name: nginx - restart
  ansible.builtin.systemd:
    name: nginx
    state: restarted
    daemon_reload: true

- name: nginx - reload
  ansible.builtin.systemd:
    name: nginx
    state: reloaded
```

## Template Safety

21. Validate Jinja2 templates produce valid config before deploying — use `validate` parameter on `template` module
22. Use `{{ variable | default('fallback') }}` to prevent undefined variable errors
23. Quote variables in templates that may contain spaces: `"{{ nginx_server_name }}"`
24. Use `ansible.builtin.template` with `backup: yes` for critical config files

```yaml
- name: Deploy nginx config
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    owner: root
    group: root
    mode: "0644"
    validate: /usr/sbin/nginx -t -c %s
    backup: yes
  notify: nginx - reload
```

## Error Handling

25. Use `block/rescue/always` for tasks that may fail and need cleanup
26. Set `any_errors_fatal: true` on critical plays — don't let partial failures leave inconsistent state
27. Use `ignore_errors: false` (the default) — only use `ignore_errors: true` with an explicit comment explaining why
28. Implement health checks after service changes — verify the service is actually working

```yaml
- name: Deploy and verify
  block:
    - name: Deploy application
      ansible.builtin.copy:
        src: app.tar.gz
        dest: /opt/app/
    - name: Restart service
      ansible.builtin.systemd:
        name: myapp
        state: restarted
    - name: Health check
      ansible.builtin.uri:
        url: "http://localhost:{{ app_port }}/health"
        status_code: 200
      retries: 5
      delay: 3
  rescue:
    - name: Rollback deployment
      ansible.builtin.copy:
        src: /opt/app/previous/
        dest: /opt/app/current/
      notify: myapp - restart
```

## Check Mode & Diff Support

29. All custom tasks must support check mode (`--check`) — use `check_mode` variable in conditional logic
30. Enable diff mode (`--diff`) for template and file tasks — shows what will change before applying

## Fact Gathering & Performance

31. Disable fact gathering (`gather_facts: false`) when not needed — saves 2-5 seconds per host
32. Use `ansible.builtin.setup` with `gather_subset` to collect only needed facts
33. Use `serial` for rolling deployments — never update all hosts simultaneously in production

## Molecule Testing

34. Every role must have a Molecule test scenario with at least: converge, verify, and idempotence steps
35. Test idempotence: run converge twice — second run must report zero changed tasks
36. Use `testinfra` or `ansible` verifier to assert final state (ports open, services running, files exist)

```yaml
# molecule/default/molecule.yml
driver:
  name: docker
platforms:
  - name: instance
    image: ubuntu:22.04
provisioner:
  name: ansible
verifier:
  name: ansible
```

## Linting & CI

37. Run `ansible-lint` in CI on every PR — zero warnings policy
38. Pin `ansible-lint` version in CI to avoid surprise failures: `ansible-lint==24.7.0`
39. Use `yamllint` for YAML formatting — enforce consistent indentation (2 spaces), line length (160 max)
40. Use `ansible-lint` profiles: `production` for deployed roles, `shared` for reusable roles

## Inventory Management

41. Use dynamic inventory for cloud environments (Azure, AWS) — never maintain static host lists for auto-scaling groups
42. Group hosts by function (`[webservers]`, `[databases]`) and environment (`[production]`, `[staging]`)
43. Use `ansible-inventory --graph` to verify inventory structure before running playbooks

## Anti-Patterns

- `shell: apt-get install -y nginx` — use `ansible.builtin.apt` module instead
- Hardcoded IPs in playbooks — use inventory groups and variables
- `when: result.rc == 0` on command output — use native modules that report state
- Secrets in `group_vars/*.yml` unencrypted — use `ansible-vault encrypt`
- Roles with 200+ line `tasks/main.yml` — split into includes
- `ignore_errors: true` without a comment explaining why
- Running playbooks without `--diff --check` first in production

## Testing & Validation

- `ansible-lint .` — zero errors before merging
- `yamllint .` — consistent formatting
- `molecule test` — converge + idempotence + verify for every role
- `ansible-playbook --syntax-check` — validates playbook syntax without execution
- `ansible-inventory --graph` — verify inventory resolves correctly

## WAF Alignment

| Pillar | How Ansible Standards Support It |
| --- | --- |
| Operational Excellence | Idempotent automation, CI linting, molecule testing, role structure |
| Reliability | Error handling with block/rescue, health checks, rolling deployments, check mode |
| Security | Vault-encrypted secrets, file permissions, no plaintext passwords, validated templates |
