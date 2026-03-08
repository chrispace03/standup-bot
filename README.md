# Smart Daily Standup Bot

A Slack bot that automates Agile standups by pulling data from Jira and Google Calendar, then posting formatted daily standup messages.

Built as a portfolio project for an Atlassian Graduate Application.

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
│  │ Scheduler    │  │ Auth (OAuth) │  │ User Preferences     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│   Slack API     │ │   Jira Cloud    │ │   Google Calendar API   │
└─────────────────┘ └─────────────────┘ └─────────────────────────┘
```

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Node.js + TypeScript | Runtime & language (strict mode) |
| Express.js 5 | Web framework |
| Firebase Firestore | Database (serverless) |
| Firebase Functions | Hosting (serverless) |
| Slack API | Bot interactions, slash commands |
| Jira Cloud REST API | Issue tracking data |
| Google Calendar API | Calendar events |
| OAuth 2.0 | Authentication for all services |
| Jest + Supertest | Testing |
| GitHub Actions | CI/CD |

## Project Structure

```
src/
├── config/          # Environment config, Firebase init
├── middleware/       # Error handling, logging, 404
├── models/          # TypeScript interfaces for all data
├── routes/          # Express route handlers
├── services/        # Business logic & Firestore CRUD
├── utils/           # Helpers (encryption, formatters)
├── app.ts           # Express app factory
└── index.ts         # Server entry point
tests/
├── helpers/         # Test utilities (Firestore mocks)
└── *.test.ts        # Unit & integration tests
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- (Later phases) Slack, Jira, and Google API credentials

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

The server runs without Firebase credentials (database routes return 503), so you can start developing immediately.

### Running

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Development (watch mode)
npm run dev
```

The server starts at `http://localhost:3000`. Check it's running:

```bash
curl http://localhost:3000/api/health
```

### Testing

```bash
npm test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/user/:slackId` | Get user profile & settings |
| PUT | `/api/user/:slackId` | Update user settings |
| POST | `/api/standup/trigger` | Trigger standup generation |
| GET | `/api/standup/history` | Get standup history |

### Planned endpoints (upcoming phases):
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/slack` | Initiate Slack OAuth |
| GET | `/auth/jira` | Initiate Jira OAuth |
| GET | `/auth/google` | Initiate Google OAuth |
| POST | `/slack/events` | Slack event subscriptions |
| POST | `/slack/commands` | Slash command handler |
| POST | `/slack/interactions` | Button/modal interactions |

## Database Schema (Firestore)

```
users/{slackUserId}       — User profile, settings, connected services
teams/{slackTeamId}       — Workspace info, default settings
tokens/{slackUserId}      — Encrypted OAuth tokens (Slack, Jira, Google)
standups/{date}_{userId}  — Historical standup records
```

## Standup Message Format

```
👤 Chris's Standup - Mon 10 Mar
─────────────────────────────────
✅ Yesterday:
  • PROJ-123: Fix login bug
  • PROJ-124: Update docs

🚀 Today:
  • PROJ-125: Build API endpoint
  • PROJ-126: Code review

🚧 Blockers: None

📅 Events:
  • 10:00 - Team Standup
  • 14:00 - Sprint Planning
```

## Security

- OAuth tokens are encrypted at rest using AES-256-GCM
- Helmet.js for HTTP security headers
- CORS configured for API access
- Error messages masked in production (no stack traces leaked)
- Slack request signing verification (upcoming)

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key groups:

- **App**: `PORT`, `NODE_ENV`, `BASE_URL`, `ENCRYPTION_KEY`
- **Slack**: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- **Jira**: `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`, `JIRA_REDIRECT_URI`
- **Google**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Firebase**: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

## License

ISC
