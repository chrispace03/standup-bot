# Smart Daily Standup Bot

![CI](https://github.com/chrispace03/standup-bot/actions/workflows/ci.yml/badge.svg)

A Slack bot that automates Agile standups by pulling data from Jira and Google Calendar, then posting formatted daily standup messages. Includes scheduled reminders, weekly summaries, and AI-powered blocker analysis.

Built as a portfolio project and to explore interest in project management software.

## Features

- **Automated standups** — pulls yesterday's completed issues, today's sprint items, and calendar events from Jira and Google Calendar
- **Scheduled delivery** — cron-based scheduler triggers standups at each user's configured time and timezone
- **Pre-standup reminders** — DM reminder 15 minutes before standup time
- **Weekly summaries** — aggregated stats (issues completed/planned, meetings, blocker days) sent on the last standup day of the week
- **AI blocker analysis** — Claude API summarizes recurring blocker patterns in weekly summaries (optional, gracefully degrades without API key)
- **Standup history** — browse recent standups via `/standup-history`
- **Interactive messages** — Regenerate, Edit Blockers, and Skip buttons on every standup
- **Settings modal** — configure timezone, standup time, active days, and target channel via `/standup-settings`
- **Multi-service OAuth** — connect Slack, Jira, and Google Calendar with encrypted token storage

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SLACK WORKSPACE                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Slash Cmds  │  │   Bot DMs   │  │   Channel Messages      │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
└─────────┼────────────────┼──────────────────────┼──────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Slack Service│  │ Jira Service │  │ Calendar Service     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Scheduler    │  │ Auth (OAuth) │  │ AI Service (Claude)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│   Slack API     │ │   Jira Cloud    │ │   Google Calendar API   │
└─────────────────┘ └─────────────────┘ └─────────────────────────┘
                           │
                    ┌──────┘
                    ▼
          ┌─────────────────┐
          │  Anthropic API  │
          └─────────────────┘
```

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Node.js + TypeScript | Runtime & language (strict mode) |
| Express.js 5 | Web framework |
| Firebase Firestore | Database (serverless) |
| Firebase Functions | Hosting (serverless) |
| Slack API | Bot interactions, slash commands, Block Kit modals |
| Jira Cloud REST API | Issue tracking data |
| Google Calendar API | Calendar events |
| Claude API | AI-powered blocker analysis (via `@anthropic-ai/sdk`) |
| OAuth 2.0 | Authentication for all services |
| node-cron | Per-user standup scheduling |
| Jest + Supertest | Testing (176 tests across 19 suites) |
| ESLint | Linting (flat config + typescript-eslint) |
| GitHub Actions | CI/CD (Node 18 + 20 matrix) |

## Project Structure

```
src/
├── config/          # Environment config, Firebase init
├── handlers/        # Slack interaction handlers (settings, buttons)
├── middleware/       # Error handling, logging, Slack verification, 404
├── models/          # TypeScript interfaces (User, Standup, Token, Team, etc.)
├── routes/          # Express route handlers (auth, slack, api)
├── services/        # Business logic (Jira, Google, Slack, AI, Scheduler)
├── types/           # Express type augmentations
├── utils/           # Encryption, formatters, modals, OAuth helpers
├── app.ts           # Express app factory
└── index.ts         # Server entry point
tests/
├── helpers/         # Test utilities (Firestore mocks)
└── *.test.ts        # Unit & integration tests (19 suites)
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- Slack, Jira, and Google API credentials
- Anthropic API key (optional, for AI blocker summaries)

### Installation

```bash
git clone https://github.com/chrispace03/standup-bot.git
cd standup-bot
npm install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

The server runs without Firebase credentials (database routes return 503), so you can start developing immediately. The AI blocker summary feature is also optional — it activates only when `ANTHROPIC_API_KEY` is set.

### Running

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Development (watch mode)
npm run dev

# Lint
npm run lint

# Type check
npm run typecheck
```

The server starts at `http://localhost:3000`. Check it's running:

```bash
curl http://localhost:3000/api/health
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/user/:slackId` | Get user profile & settings |
| PUT | `/api/user/:slackId` | Update user settings |
| POST | `/api/standup/trigger` | Trigger standup generation |
| GET | `/api/standup/history` | Get standup history for a user |
| POST | `/api/scheduler/tick` | Trigger scheduler tick (for external schedulers) |
| GET | `/auth/slack` | Initiate Slack OAuth |
| GET | `/auth/slack/callback` | Slack OAuth callback |
| GET | `/auth/jira` | Initiate Jira OAuth |
| GET | `/auth/jira/callback` | Jira OAuth callback |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |
| POST | `/slack/commands` | Slash command handler |
| POST | `/slack/events` | Slack event subscriptions |
| POST | `/slack/interactions` | Button/modal interactions |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/standup` | Generate and post your standup |
| `/standup-settings` | Open settings modal (timezone, time, days, channel) |
| `/standup-connect` | View service connection status with auth links |
| `/standup-history` | Browse your recent standup history |

## Scheduler

The built-in scheduler runs every minute and handles:

1. **Standup generation** — triggers at each user's configured time in their timezone
2. **Reminders** — sends a DM 15 minutes before standup time
3. **Weekly summaries** — on the user's last standup day of the week, posts aggregated stats
4. **AI analysis** — if configured, Claude analyzes the week's blockers for patterns and escalation needs
5. **Deduplication** — skips if a standup already exists for the day

## Database Schema (Firestore)

```
users/{slackUserId}       — User profile, settings, connected services
teams/{slackTeamId}       — Workspace info, default settings
tokens/{slackUserId}      — Encrypted OAuth tokens (Slack, Jira, Google)
standups/{date}_{userId}  — Historical standup records
```

## Standup Message Format

```
Chris's Standup - Mon 10 Mar
─────────────────────────────────
Yesterday:
  • PROJ-123: Fix login bug
  • PROJ-124: Update docs

Today:
  • PROJ-125: Build API endpoint
  • PROJ-126: Code review

Blockers: None

Events:
  • 10:00 - Team Standup
  • 14:00 - Sprint Planning

[Regenerate] [Edit Blockers] [Skip Today]
```

## Weekly Summary Format

```
Chris's Weekly Summary
Mon 9 Mar – Fri 13 Mar
─────────────────────────────────
Standups completed: 5
Issues completed: 12
Issues planned: 8
Meetings attended: 6
Days with blockers: 1

Blockers this week:
  • Tue 10 Mar: Waiting on API access

AI Analysis:
The only blocker this week was an external dependency on API access.
Consider following up with the platform team to prevent recurrence.
```

## Security

- OAuth tokens are encrypted at rest using AES-256-GCM
- Helmet.js for HTTP security headers
- CORS configured for API access
- Error messages masked in production (no stack traces leaked)
- Slack request signing verification on all Slack routes

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key groups:

- **App**: `PORT`, `NODE_ENV`, `BASE_URL`, `ENCRYPTION_KEY`
- **Slack**: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- **Jira**: `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`, `JIRA_REDIRECT_URI`
- **Google**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Anthropic**: `ANTHROPIC_API_KEY` (optional — enables AI blocker analysis in weekly summaries)
- **Firebase**: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

## License

ISC
