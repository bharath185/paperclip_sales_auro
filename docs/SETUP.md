# Auro OpenCode: Setup & Deployment Guide

This guide details installation, environment variable configuration, Docker deployment, and platform-specific sandboxing considerations for Auro OpenCode.

---

## 1. System Requirements

- **Node.js**: `v20.18.x`, `v22.x`, or `v24.x` (LTS recommended)
- **pnpm**: `v9.x` or later (`npm install -g pnpm`)
- **Git**: `v2.40+`
- **Docker & Docker Compose**: Recommended for production and Windows agent containment

---

## 2. Local Development Setup (Embedded PGlite)

By default, Auro OpenCode runs with an embedded **PGlite** database when `DATABASE_URL` is omitted. This requires zero external database installation.

```bash
# 1. Clone repository
git clone https://github.com/bharath185/project_auro_opencode.git
cd project_auro_opencode

# 2. Install dependencies
pnpm install

# 3. Create .env from template
cp .env.example .env

# 4. Initialize Database Migrations
pnpm db:migrate

# 5. Start Development Server & UI
pnpm dev
```

The application starts on **`http://localhost:3100`**.

---

## 3. Environment Variables Reference

See `.env.example` for all configurable variables.

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `3100` | HTTP port for API server and UI bundle. |
| `NODE_ENV` | No | `development` | Runtime mode (`development`, `test`, `production`). |
| `DATABASE_URL` | No | *(embedded PGlite)* | PostgreSQL connection URI for production databases. |
| `APP_ENCRYPTION_KEY` | Recommended | *(auto-generated)* | 64-char hex key for AES-256-GCM credential encryption at rest. |
| `OPENCODE_API_KEY` | Optional | *(empty / simulated)* | API Key for OpenCode upstream models. When omitted, deterministic simulator is used. |
| `SALES_EMAIL_DRY_RUN` | No | `true` | When `true`, outbound emails route to local mail sink. |
| `SANDBOX_OVERRIDE_UNCONFINED` | No | `false` | When `true`, allows unconfined agent tool execution on Windows host (requires explicit admin consent). |

---

## 4. Production Deployment with Docker Compose

For containerized deployment with a dedicated PostgreSQL database:

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env to set a secure APP_ENCRYPTION_KEY and optional OPENCODE_API_KEY

# 2. Build and launch containers
docker compose up -d --build

# 3. Check health and logs
docker compose ps
docker compose logs -f app
```

---

## 5. Windows Host Sandboxing Notice

On Windows hosts, native Linux namespace sandboxing (`bwrap` / Bubblewrap) is not available. To protect the host operating system from untrusted tool execution:

1. **Recommended**: Run Auro OpenCode inside **Docker Desktop** or **WSL2** (Windows Subsystem for Linux), where full Linux container isolation is active.
2. **Native Windows Fallback**: Tool-running agents default to **disabled** on Windows host processes. To explicitly permit unconfined local command execution, set `SANDBOX_OVERRIDE_UNCONFINED=true` in your `.env` file and acknowledge the administrative security prompt in the dashboard.
