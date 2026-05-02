# Tennis Club Court Booking

A web app for managing tennis court reservations. Members can post booking requests (open or named), join each other's requests, and manage their upcoming sessions. Admins can manage members, courts, schedules, and view usage statistics.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Running locally](#running-locally)
- [Environment variables explained](#environment-variables-explained)
- [Deploying to Vercel](#deploying-to-vercel)

---

## Prerequisites

You need **Python**, **Node.js**, and **uv** installed. If you are on a fresh machine, follow the steps below.

### 1. Install Python

Go to https://www.python.org/downloads and download the latest Python 3.12 installer for your OS. Run it and follow the prompts.

Verify it worked:
```bash
python --version
# should print: Python 3.12.x
```

### 2. Install uv (Python package manager)

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Restart your terminal, then verify:
```bash
uv --version
```

### 3. Install Node.js

Go to https://nodejs.org and download the LTS version. Run the installer.

Verify:
```bash
node --version   # should print v20.x or higher
npm --version
```

---

## Running locally

SQLite is bundled with Python — no database installation needed.

### Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd tennis
```

### Step 2 — Create your environment file

```bash
cp .env.example .env
```

Then open `.env` in any text editor and fill it in. See [Environment variables explained](#environment-variables-explained) below for what each value means.

For a quick local run, you only need to change `SECRET_KEY`:

```
POSTGRES_URL=sqlite+aiosqlite:///./tennis.db
SECRET_KEY=any-long-random-string-change-this
```

### Step 3 — Install Python dependencies

```bash
uv venv
uv pip install -r requirements.txt
```

This creates a virtual environment in `.venv/` and installs all packages.

### Step 4 — Seed the database

This creates all the tables and inserts the initial data: 3 courts, default open hours, and one admin account.

```bash
uv run python -m api.seed
```

You should see:
```
Seeded: 3 courts, default settings, admin@tennisclub.com / changeme
```

> Change the admin password after your first login via the admin panel.

### Step 5 — Install frontend dependencies

```bash
npm install
```

### Step 6 — Start both servers

Open **two terminals** and run one command in each:

**Terminal 1 — API** (runs on http://localhost:8000):
```bash
uv run python run_dev.py
```

**Terminal 2 — Frontend** (runs on http://localhost:5173):
```bash
npm run dev
```

### Step 7 — Open the app

Go to http://localhost:5173 in your browser.

Log in with:
- **Email:** `admin@tennisclub.com`
- **Password:** `changeme`

---

## Environment variables explained

Your `.env` file controls how the app connects to services. Here is what each variable does:

### `POSTGRES_URL`
The database connection string.

- **Locally:** Use SQLite — no setup needed:
  ```
  POSTGRES_URL=sqlite+aiosqlite:///./tennis.db
  ```
  This creates a file called `tennis.db` in the project folder.

- **In production:** Vercel Postgres injects this automatically. You do not need to set it manually on Vercel.

### `SECRET_KEY`
A secret string used to sign login tokens. Anyone with this value can forge login sessions, so keep it private.

- **Locally:** Any long random string works, for example:
  ```
  SECRET_KEY=local-dev-secret-not-used-in-prod
  ```
- **In production:** Generate a strong random value. On macOS/Linux:
  ```bash
  openssl rand -hex 32
  ```

### `RESEND_API_KEY`
API key for sending emails (booking confirmations, password resets).

- **Optional.** If not set, emails are silently skipped. The app works fully without it.
- To enable emails: sign up at https://resend.com, create an API key, and paste it here:
  ```
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
  ```

### `FROM_EMAIL`
The sender address that appears on outgoing emails. Must be a domain you have verified in Resend.

- Only needed if `RESEND_API_KEY` is set.
- Example: `FROM_EMAIL=tennis@yourclub.com`

### `FRONTEND_URL`
The base URL of the frontend. Used to build the password reset link in emails.

- **Locally:** Already defaults to `http://localhost:5173`, no need to set it.
- **In production:** Set this to your Vercel deployment URL, for example:
  ```
  FRONTEND_URL=https://tennis-club.vercel.app
  ```

---

## Deploying to Vercel

### Step 1 — Push your code to GitHub

Create a new repository on https://github.com and push:

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/your-username/tennis-club.git
git push -u origin main
```

### Step 2 — Create a Vercel account

Go to https://vercel.com and sign up. You can use your GitHub account.

### Step 3 — Import the project

1. From the Vercel dashboard, click **Add New → Project**
2. Select your GitHub repository
3. Click **Deploy** — Vercel will auto-detect the configuration from `vercel.json`

### Step 4 — Create a Postgres database

1. In your Vercel project, go to the **Storage** tab
2. Click **Create Database → Postgres**
3. Follow the prompts — pick the free tier
4. Vercel automatically injects `POSTGRES_URL` (and related variables) into your project

### Step 5 — Set environment variables

In your Vercel project, go to **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `SECRET_KEY` | Run `openssl rand -hex 32` and paste the result |
| `FRONTEND_URL` | Your Vercel deployment URL, e.g. `https://tennis-club.vercel.app` |
| `RESEND_API_KEY` | Optional — only if you want emails to work |
| `FROM_EMAIL` | Optional — only if you want emails to work |

> `POSTGRES_URL` is injected automatically by Vercel Postgres — do not add it manually.

### Step 6 — Seed the production database

After the first deploy, run the seed script once against the production database. The easiest way is via the Vercel CLI:

```bash
npm i -g vercel
vercel login
vercel env pull .env.production.local    # pulls production env vars locally
DOTENV_CONFIG_PATH=.env.production.local uv run python -m api.seed
```

Or you can temporarily add a seed endpoint in the admin API and call it once — but the CLI approach above is simpler.

### Step 7 — Redeploy on code changes

Any push to `main` triggers a new deployment automatically.
