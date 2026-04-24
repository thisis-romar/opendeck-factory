---
title: "GitHub App Setup — opendeck-project-sync"
description: One-time manual steps to create and install the GitHub App that powers project-sync.yml and status-update.yml
lastmod: 2026-04-24T00:00:00Z
created: 2026-04-24T00:00:00Z
---

# Playbook: GitHub App Setup

## Why a GitHub App?

`GITHUB_TOKEN` in Actions is repo-scoped and **cannot** access the Projects v2 API. You need either a GitHub App token or a PAT with `project` write scope. A GitHub App is preferred because:
- Scoped precisely to the repos and permissions you specify
- Token is short-lived (60 min) — no rotation needed
- Auditable in the organization security log

---

## Step 1: Register the App

Navigate to: **`github.com/settings/apps/new`** (user-level; not org-level)

Fill in:
- **App name:** `opendeck-project-sync`
- **Homepage URL:** `https://github.com/thisis-romar/opendeck-factory`
- **Webhook:** Uncheck "Active" (not needed)

**Required permissions:**

| Permission | Level |
|---|---|
| Issues | Read and write |
| Pull requests | Read and write |
| Projects | Admin |
| Metadata | Read-only (required by GitHub) |
| Contents | Read-only |

Leave all "Subscribe to events" checkboxes unchecked. Click **Create GitHub App**.

---

## Step 2: Generate a private key

After creation, scroll to the **Private keys** section and click **Generate a private key**. A `.pem` file downloads.

**Do NOT commit this file.** Store it as a repository secret immediately (Step 4).

---

## Step 3: Note the App ID

On the App settings page, find the **App ID** field at the top. Copy the integer (e.g. `12345`).

---

## Step 4: Store credentials as repo secrets/variables

Navigate to: `github.com/thisis-romar/opendeck-factory/settings/secrets/actions`

1. **New secret** → name: `PROJECT_SYNC_APP_KEY` → value: paste the entire contents of the `.pem` file (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines).

Navigate to: `github.com/thisis-romar/opendeck-factory/settings/variables/actions`

2. **New variable** → name: `PROJECT_SYNC_APP_ID` → value: the integer App ID from Step 3.

---

## Step 5: Install the App on the three repos

Navigate to your App settings → **Install App** tab.

Click **Install** next to your account (`thisis-romar`).

When prompted, choose **Only select repositories** and select:
- `thisis-romar/opendeck-factory`
- `thisis-romar/stream-deck-catalog`
- `thisis-romar/opendeck-planning`

Click **Install**.

---

## Step 6: Verify the workflows run correctly

### Test project-sync

1. Navigate to: `github.com/thisis-romar/opendeck-factory/actions/workflows/project-sync.yml`
2. Click **Run workflow** → **Run workflow** (main branch, no inputs needed)
3. Watch the run complete green. Check project #4 — no items should have changed (it's idempotent on first run).

### Test status-update

1. Navigate to: `github.com/thisis-romar/opendeck-factory/actions/workflows/status-update.yml`
2. Click **Run workflow** → choose `ON_TRACK` status → enter a short body like `"Manual test run — cron not yet active"` → Run
3. Verify a new status update appears on the project side panel at `github.com/users/thisis-romar/projects/4`

---

## Ongoing: Key rotation

GitHub App private keys don't auto-expire but should be rotated periodically.

**When to rotate:** every 6 months, or immediately if you suspect the `.pem` was exposed.

**How:**
1. Generate a new private key on the App settings page
2. Update the `PROJECT_SYNC_APP_KEY` secret with the new key
3. Delete the old key from the App settings page

---

## Known gotchas

- **`actions/create-github-app-token@v1`** — requires `app-id` (integer) via `vars.PROJECT_SYNC_APP_ID` and `private-key` (PEM string) via `secrets.PROJECT_SYNC_APP_KEY`. Make sure you are not confusing the secret name with the variable name.
- **Installation scope** — if the App is only installed on one repo, it can't generate tokens scoped to the other repos. Install on all three before testing.
- **`project` scope is "Admin"** — this is not an error. Projects v2 mutations require `admin` project permission in the App, not just `write`.
