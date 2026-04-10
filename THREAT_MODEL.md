# Threat Model — Cove / Lighthouse Sanctuary Platform

**Classification:** Internal  
**Date:** 2026-04-09  
**Authors:** Development Team  
**Methodology:** STRIDE

---

## 1. System Overview

The Cove platform is a three-tier web application for Lighthouse Sanctuary, a 501(c)(3) nonprofit managing child welfare cases in the Philippines.

### Architecture

```
[Browser / SPA]  ──HTTPS──►  [ASP.NET Core API]  ──TLS──►  [PostgreSQL / Supabase]
    React + Vite                   Azure App Service              AWS us-east-1
    Vercel CDN
```

### Data Flows

| Flow | Sensitivity |
|------|-------------|
| Admin ↔ Resident records | Critical (PII, child welfare data) |
| Donor registration & donations | High (PII, financial) |
| Social worker ↔ Case notes | High (PII, legal records) |
| Public donation form (anonymous) | Medium |
| ML predictions (internal) | Low |
| Social media AI assistant | Low |

### Trust Boundaries

1. **Public internet → API** (unauthenticated callers)
2. **Authenticated user → API** (role-validated callers: Admin, SocialWorker, Donor)
3. **API → Database** (service account, no user-level row security)
4. **API → External services** (Anthropic AI, Lighthouse ML API, SMTP)

---

## 2. Assets & Sensitivity

| Asset | Sensitivity | Impact if Compromised |
|-------|------------|----------------------|
| Resident case records | Critical | Legal liability, child safety risk |
| Supporter PII (name, email) | High | Privacy violation, regulatory exposure |
| JWT signing key | Critical | Full account takeover for all users |
| Database credentials | Critical | Complete data breach |
| Anthropic API key | Medium | Financial (API billing abuse) |
| Admin credentials | Critical | Full system control |
| Social worker credentials | High | Unauthorized case access |

---

## 3. STRIDE Threat Analysis

### 3.1 Spoofing

| ID | Threat | Mitigation |
|----|--------|-----------|
| S1 | Attacker forges JWT to impersonate any user | JWT signed with HS256; 64-byte secret stored outside source control |
| S2 | Credential stuffing against login endpoint | Account lockout after 5 failures (15 min); rate limit 5 req/min/IP |
| S3 | Brute-force 2FA code (6 digits = 1M possibilities) | Rate limit on `/auth/2fa/verify`; token expires in 10 min |
| S4 | Session hijacking via stolen JWT | JWT revocation on logout; 8-hour expiry; HTTPS enforced |

### 3.2 Tampering

| ID | Threat | Mitigation |
|----|--------|-----------|
| T1 | SQL injection via user input | All raw SQL uses parameterized queries; EF Core for ORM queries |
| T2 | XSS via stored input in case notes | `InputSanitizer` decodes HTML entities, strips tags, blocks `javascript:` |
| T3 | Unauthorized modification of resident records | `[Authorize(Roles = "Admin")]` on all write endpoints; social workers read-only on assigned residents |
| T4 | Donation attributed to wrong supporter | `SupporterId` validated against DB before insert |
| T5 | Malicious redirect after login | Redirect parameter validated: must start with `/`, must not contain `://` |

### 3.3 Repudiation

| ID | Threat | Mitigation |
|----|--------|-----------|
| R1 | Admin denies creating/deleting a record | Structured logging on all auth events (login, logout, 2FA) with user ID and IP |
| R2 | No audit trail for case data changes | **Gap:** CreatedBy/ModifiedBy columns not yet implemented — see Section 5 |

### 3.4 Information Disclosure

| ID | Threat | Mitigation |
|----|--------|-----------|
| I1 | Internal exception details leaked to client | Generic error messages returned; full stack traces logged server-side only |
| I2 | Database credentials in source control | Moved to environment variables / `appsettings.Development.json` (gitignored) |
| I3 | API infrastructure names visible in frontend | Fallback URL still present in `authService.ts` — low risk but noted |
| I4 | Sensitive data over HTTP | HTTPS enforced; HSTS header set |
| I5 | Clickjacking — app embedded in iframe | `X-Frame-Options: DENY` header set |
| I6 | MIME sniffing attacks | `X-Content-Type-Options: nosniff` header set |
| I7 | Referrer leaks internal paths | `Referrer-Policy: strict-origin-when-cross-origin` header set |

### 3.5 Denial of Service

| ID | Threat | Mitigation |
|----|--------|-----------|
| D1 | Brute-force / credential stuffing floods auth | Rate limit: 5 req/min/IP on `/auth/login`, `/auth/register`, `/auth/2fa/verify` |
| D2 | Flood of anonymous donations or supporter lookups | Rate limit: 30 req/min/IP on public endpoints |
| D3 | Memory exhaustion from unbounded DB result sets | `GetAll` endpoints capped at 500 records with pagination |
| D4 | Thread exhaustion from slow external API calls | 30-second timeout on all Anthropic API calls |

### 3.6 Elevation of Privilege

| ID | Threat | Mitigation |
|----|--------|-----------|
| E1 | Social worker accesses residents not assigned to them | `GetResidents` filters by `AssignedSocialWorker == username` for non-admins |
| E2 | Donor accesses admin endpoints | Role-based authorization enforced on every controller |
| E3 | Anonymous caller creates donations for arbitrary supporters | `SupporterId` validated to exist before insert |
| E4 | Age outside valid range accepted for child residents | Age validated: 0–25 before `CreateResident` persists |

---

## 4. CSRF Analysis

**Conclusion: Not applicable to this application.**

The API uses JWT Bearer token authentication. The token is stored in `localStorage` and sent in the `Authorization: Bearer <token>` request header. Browsers never automatically send this header in cross-origin requests, so a malicious third-party site cannot forge authenticated API calls. The CSRF attack surface requires cookie-based authentication, which this application does not use for auth.

---

## 5. Residual Risks / Open Items

| ID | Risk | Severity | Owner |
|----|------|----------|-------|
| O1 | No CreatedBy/ModifiedBy audit columns on case records | Medium | Backend |
| O2 | JWT revocation list is in-memory — lost on restart | Low | Backend (acceptable for single instance) |
| O3 | 2FA via email is weaker than TOTP authenticator apps | Medium | Backend |
| O4 | Social worker → resident mapping uses string comparison, not FK relationship | Medium | Backend |
| O5 | No automated dependency vulnerability scanning in CI/CD pipeline | Low | DevOps |

---

## 6. Security Assumptions

- Azure App Service enforces TLS termination; HTTP redirects to HTTPS at the platform level
- Supabase/PostgreSQL connection uses TLS in transit
- The ML API (`lighthouse-ml-api-intex.azurewebsites.net`) is a trusted internal service
- Deploy pipeline (GitHub Actions) does not expose secrets in logs
