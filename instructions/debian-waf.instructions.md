---
description: "Debian/Ubuntu administration standards — apt, systemd, UFW firewall, and server hardening."
applyTo: "**/*.sh, **/*.conf"
waf:
  - "reliability"
  - "security"
---

# Debian / Ubuntu — FAI Standards

## Core Rules

- Use `apt` (never `apt-get` in scripts without `-y` and `DEBIAN_FRONTEND=noninteractive`)
- Pin critical packages with `apt-mark hold <pkg>` to prevent unintended upgrades
- Every service runs as a dedicated non-root user with `DynamicUser=yes` or explicit `User=`/`Group=`
- All shell scripts start with `#!/usr/bin/env bash`, use `set -euo pipefail`, and pass `shellcheck`
- SSH root login disabled (`PermitRootLogin no`), key-only auth (`PasswordAuthentication no`)
- UFW enabled on all servers — default deny inbound, explicit allow per service port
- Unattended security upgrades enabled via `unattended-upgrades` with reboot window
- Filesystem permissions: config files `0640 root:<service-group>`, secrets `0600 root:root`
- Logs managed by journald with persistent storage and size caps — no unbounded `/var/log` growth
- AppArmor enforcing on all custom services — never disable for convenience

## Package Management

```bash
# Preferred: non-interactive, auto-confirm, clean after install
export DEBIAN_FRONTEND=noninteractive
apt update && apt install -y --no-install-recommends nginx curl && apt clean

# Pin a package to prevent upgrade breakage
apt-mark hold postgresql-16

# Remove unused dependencies
apt autoremove -y --purge
```

- Always use `--no-install-recommends` to minimize attack surface
- Add third-party repos via signed `.sources` files in `/etc/apt/sources.list.d/`, never piping `curl | bash`
- Verify GPG keys with `gpg --verify` before adding to trusted keyring

## Systemd Service Files

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=MyApp API Server
After=network-online.target postgresql.service
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=notify
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/server --config /etc/myapp/config.yaml
Restart=on-failure
RestartSec=5s
WatchdogSec=30s
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
PrivateTmp=yes
ReadWritePaths=/var/lib/myapp /var/log/myapp

[Install]
WantedBy=multi-user.target
```

- Use `ProtectSystem=strict`, `NoNewPrivileges=yes`, `PrivateTmp=yes` on every custom service
- Set `StartLimitBurst` + `StartLimitIntervalSec` to prevent crash-loop storms
- Use `WatchdogSec` with `Type=notify` for health-aware restart

## SSH Hardening (`/etc/ssh/sshd_config.d/hardening.conf`)

```bash
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy admin
Protocol 2
```

## UFW Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
ufw status verbose
```

- Never use `ufw allow <port>` without specifying protocol (`/tcp` or `/udp`)
- Use `ufw limit 22/tcp` on public-facing SSH to rate-limit brute force

## Fail2ban

```ini
# /etc/fail2ban/jail.local
[sshd]
enabled = true
port = 22
maxretry = 5
bantime = 3600
findtime = 600
```

## Unattended Upgrades

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
# /etc/apt/apt.conf.d/50unattended-upgrades
# Unattended-Upgrade::Automatic-Reboot "true";
# Unattended-Upgrade::Automatic-Reboot-Time "03:00";
```

## Log Management with journald

```ini
# /etc/systemd/journald.conf.d/retention.conf
[Journal]
Storage=persistent
SystemMaxUse=500M
MaxRetentionSec=30day
Compress=yes
```

- Query with `journalctl -u myapp --since "1 hour ago" --no-pager -o json`
- Forward to remote syslog with `ForwardToSyslog=yes` for centralized logging

## User & Group Management

```bash
# Create service account — no login shell, no home
useradd --system --no-create-home --shell /usr/sbin/nologin myapp
# Add deploy user with sudo
useradd -m -G sudo -s /bin/bash deploy
```

## Network Configuration (Netplan)

```yaml
# /etc/netplan/01-config.yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses: [10.0.1.10/24]
      routes:
        - to: default
          via: 10.0.1.1
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```

Apply with `netplan apply` — never edit `/etc/network/interfaces` on modern Ubuntu.

## Backup with rsync / borgbackup

```bash
# Incremental encrypted backup with borg
borg create --compression zstd,3 --encryption repokey \
  /backup/repo::'{hostname}-{now}' /etc /var/lib/myapp /opt/myapp
borg prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6 /backup/repo
```

## Anti-Patterns

- ❌ Running services as root when they don't need privileged ports
- ❌ `chmod 777` or `chmod -R 777` — always set minimal required permissions
- ❌ Piping `curl | bash` for installation — download, inspect, then execute
- ❌ Disabling AppArmor/UFW to "fix" connectivity issues — fix the rule instead
- ❌ Using `crontab -e` for tasks that should be systemd timers (no logging, no dependency)
- ❌ Editing `/etc/resolv.conf` directly — it's managed by `systemd-resolved` or netplan
- ❌ Running `apt upgrade -y` in production without `--no-install-recommends` and testing
- ❌ Storing secrets in plaintext `/etc/environment` or shell profiles
- ❌ `kill -9` as first resort — send `SIGTERM`, wait, then escalate
- ❌ Ignoring `needrestart` — services using outdated libs remain vulnerable

## WAF Alignment

| Pillar | Debian/Ubuntu Practice |
|--------|----------------------|
| **Security** | SSH key-only auth, UFW default-deny, fail2ban, AppArmor enforcing, `NoNewPrivileges` in systemd, unattended security patches |
| **Reliability** | Systemd restart policies with backoff, watchdog health checks, `apt-mark hold` for critical packages, borg backup with retention |
| **Cost Optimization** | `--no-install-recommends` to reduce image size, journald size caps, `apt autoremove --purge`, systemd resource limits (`MemoryMax`, `CPUQuota`) |
| **Operational Excellence** | Journald persistent logging with JSON output, netplan declarative networking, systemd timers over cron, `needrestart` after upgrades |
| **Performance Efficiency** | `zstd` compression for backups, journald compression, systemd socket activation for on-demand services, `PrivateTmp` reduces I/O contention |
| **Responsible AI** | Audit trails via journald, user isolation with dedicated service accounts, file permission enforcement for model artifacts |
