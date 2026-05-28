# Security Policy — TakaSports

## Reporting a Vulnerability

If you discover a security vulnerability in TakaSports, please report it responsibly:

- **Email**: security@takasportsmedia.com
- **Response time**: We aim to respond within 72 hours and patch critical issues within 7 days.
- **Please do NOT** open a public GitHub issue for security vulnerabilities.

We appreciate responsible disclosure and will credit researchers who report valid issues (unless anonymity is preferred).

---

## Security Architecture

### Authentication

- User auth via **Supabase Auth** (OAuth: Google, Apple; Email+Password)
- Admin access requires both a valid Supabase session AND an email in `ADMIN_EMAILS` env var
- Server-to-server calls (n8n, cron) use static shared secrets via `Authorization: Bearer` or custom headers (`x-cron-secret`, `x-push-secret`, etc.)
- Timing-safe comparison (`crypto.timingSafeEqual`) used for all secret checks

### CSRF Protection

- Origin/Referer validation on all mutating HTTP methods (POST/PUT/PATCH/DELETE)
- Exemptions: Bearer tokens, known server-to-server headers, localhost in dev

### Rate Limiting

- IP-based rate limiting on all public mutation endpoints via Supabase `rate_limits` table
- Key limits: push subscribe 10/hr, newsletter 5/hr, comments 20/hr, reports 30/hr, reels ingest 60/hr

### Content Security Policy

- CSP header on all pages via `next.config.ts`
- `unsafe-eval` only allowed in development (removed in production)
- `frame-src` restricted to `https://www.instagram.com` only

### Database Security (Supabase / PostgreSQL)

- Row Level Security (RLS) enabled on all user-facing tables
- `push_subscriptions` INSERT policy: `user_id IS NULL OR user_id = auth.uid()`
- `increment_comment_flag` EXECUTE revoked from `anon`/`authenticated` — only `service_role`
- Game RPCs (`record_game_play`, `ping_game_streak`, `quiniela_consensus`) revoked from `anon`
- All SECURITY DEFINER functions have `search_path = ''` to prevent schema hijacking

### Known Technical Debt

- `add_coins` and `award_game_coins` are still callable by `authenticated` users via the REST API (not just `service_role`). An authenticated user can invoke these with arbitrary payloads up to the internal 5,000-coin cap. Planned fix: move coin logic to server-side API routes with service_role, then revoke EXECUTE from `authenticated`.
- CSP uses `unsafe-inline` for scripts (Next.js hydration requirement). Nonce-based CSP is on the roadmap.

### Infrastructure

- HSTS with `max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Deployed on Vercel (edge network, DDoS protection included)
- Secrets stored in Vercel environment variables (never in source code or git)

---

## Scope

In scope for responsible disclosure:
- `takasportsmedia.com` and all subdomains
- The TakaSports web application (Next.js)
- API endpoints under `/api/`

Out of scope:
- Third-party services (Supabase dashboard, Sanity Studio, Vercel dashboard)
- Social engineering attacks
- Issues requiring physical access

---

*Last updated: 2026-05-28*
