# TrendMetrics - AI-Powered Market Intelligence Platform

TrendMetrics is a production-grade market intelligence platform that tracks, analyzes, and transforms real-time trend data from social media, e-commerce, app stores, search engines, and travel platforms into actionable business strategies.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  Dashboard │ Trend Detail │ Reports │ Credits │ Compare         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────────┐
│                     Backend (Node.js/Express)                    │
│                                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────────┐│
│  │   Auth    │  │   Credits   │  │  Reports │  │    Admin     ││
│  │  Service  │  │   Service   │  │  Service │  │   Service    ││
│  └──────────┘  └─────────────┘  └──────────┘  └──────────────┘│
│                                                                  │
│  ┌──────────────────── Trend Pipeline ──────────────────────┐  │
│  │ Discovery → Normalize → Deduplicate → Verify → Score →   │  │
│  │ Insight Generation                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────── Connectors ──────────────────────────┐  │
│  │ YouTube │ TikTok │ Instagram │ Amazon │ AppStore │ ...    │  │
│  │ (API)   │(Ground)│ (Ground)  │(Ground)│ (Ground) │        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  3-Tier  │  │  AI Provider │  │     Queue / Scheduler   │  │
│  │  Cache   │  │  (Gemini)    │  │                          │  │
│  └──────────┘  └─────────────┘  └──────────────────────────┘  │
└──────────┬──────────────┬───────────────────────────────────────┘
           │              │
     ┌─────▼────┐  ┌──────▼──────┐  ┌───────────────┐
     │PostgreSQL │  │  Firestore  │  │    Redis      │
     │ (Primary) │  │  (Auth/RT)  │  │  (Optional)   │
     └──────────┘  └─────────────┘  └───────────────┘
```

## Key Design Principles

1. **No fake metrics**: If data can't be verified, it's labeled as such
2. **Explainable scores**: Every score shows exactly why it's that value
3. **Graceful degradation**: Platform connectors fail independently
4. **Three evidence levels**: Verified Data → Inferred Insights → Weak Signals
5. **Capability-based connectors**: Each platform declares what it can and can't do
6. **Decision-ready output**: Not raw data dumps, but actionable intelligence

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Zustand |
| Backend | Node.js, TypeScript, Express, Drizzle ORM |
| Database | PostgreSQL 16 (primary), Firestore (auth/real-time) |
| AI | Google Gemini via @google/genai SDK with Search Grounding |
| Auth | Firebase Authentication (Google Sign-In) |
| Cache | Three-tier: Hot (15m) → Daily (24h) → History (7d) |
| Queue | Bull (Redis) or in-memory fallback |

## Project Structure

```
packages/
├── shared/              # Shared types and constants
│   └── src/
│       ├── types.ts     # All TypeScript interfaces
│       └── index.ts
├── backend/
│   └── src/
│       ├── config/      # Environment config, logger
│       ├── db/          # Drizzle schema, migrations, seeds
│       ├── middleware/   # Auth, rate-limit, error handling
│       ├── providers/   # AI provider abstraction
│       ├── modules/
│       │   ├── auth/        # Firebase auth service + routes
│       │   ├── credit/      # Balance, transactions, idempotency
│       │   ├── discovery/   # Trend pipeline orchestration
│       │   ├── connector/   # Platform connectors (base, registry, implementations)
│       │   ├── normalization/
│       │   ├── deduplication/
│       │   ├── verification/
│       │   ├── scoring/     # Explainable scoring engine
│       │   ├── insight/     # AI-powered business insights
│       │   ├── report/      # Deep analysis + daily reports
│       │   ├── cache/       # Three-tier cache
│       │   ├── health/
│       │   └── admin/
│       ├── queue/       # Job queue setup
│       ├── utils/       # Validation, helpers
│       └── index.ts     # Express app entry
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/      # Navbar, Sidebar, AppLayout
        │   ├── common/      # Badges, states, reusable UI
        │   ├── dashboard/   # Dashboard-specific
        │   ├── trend/       # Trend cards, detail, scores
        │   ├── report/      # Analysis & report modals
        │   └── credit/      # Top-up, transaction history
        ├── pages/           # Landing, Dashboard, TopUp, Reports, Compare
        ├── stores/          # Zustand state management
        ├── services/        # API client, Firebase client
        ├── hooks/
        ├── types/
        └── utils/           # Formatters, platform configs
```

## Getting Started

### Prerequisites
- Node.js >= 20
- Docker & Docker Compose (for PostgreSQL + Redis)
- Firebase project with Auth enabled
- Google Gemini API key

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd trendmetrics
npm install
cd packages/backend && npm install
cd ../frontend && npm install
cd ../..

# 2. Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your Firebase and Gemini credentials

# 4. Run database migrations
npm run db:migrate

# 5. Seed sample data
npm run db:seed

# 6. Start development
npm run dev
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

## Platform Connector Strategy

| Platform | Access Method | Reliability | Notes |
|----------|--------------|-------------|-------|
| YouTube | Official API / Grounded Search | High | Uses Data API v3 when key available |
| TikTok | Grounded Search | Medium | No stable public API |
| Instagram | Grounded Search | Medium | Meta API limited to business accounts |
| X (Twitter) | Grounded Search | Medium | API access restricted |
| Facebook | Grounded Search | Medium | Limited public data |
| Twitch | Grounded Search | Medium | Helix API possible future addition |
| Amazon | Grounded Search | Medium | No public trend API |
| Trendyol | Grounded Search | Low | Local platform, limited signals |
| Hepsiburada | Grounded Search | Low | Local platform, limited signals |
| Sahibinden | Grounded Search | Low | Classifieds, limited trend data |
| App Store | Grounded Search | Medium | Public listing metadata |
| Google Play | Grounded Search | Medium | Public listing metadata |
| Airbnb | Grounded Search | Medium | Travel trend signals |
| TripAdvisor | Grounded Search | Medium | Review-based signals |
| Booking.com | Grounded Search | Medium | Booking trend signals |
| Google Business | Grounded Search | Low | Local business signals |
| Google Search | Grounded Search | High | Direct search trends |
| Yandex | Grounded Search | Medium | Regional search trends |

## Credit System

| Operation | Cost |
|-----------|------|
| Sign Up Bonus | +$10.00 |
| Trend Discovery | Free (cached) |
| Force Refresh | $1.00 |
| Deep Analysis Report | $3.00 |
| Daily Market Report | $2.00 |

All credit operations use idempotency keys and database transactions.
Failed AI operations trigger automatic refunds.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/session | Create session from Firebase token |
| GET | /api/auth/me | Get current user profile |
| POST | /api/trends/discover | Discover trends (main pipeline) |
| GET | /api/trends/:id | Get trend details |
| POST | /api/trends/:id/deep-analysis | Generate deep analysis report |
| POST | /api/reports/daily | Generate daily market report |
| GET | /api/reports/history | Get report history |
| GET | /api/credits/balance | Get credit balance |
| POST | /api/credits/topup | Top up credits |
| GET | /api/credits/history | Get transaction history |
| GET | /api/health | Health check |
| GET | /api/admin/connectors | Connector status (admin) |

## License

Proprietary - All rights reserved.
