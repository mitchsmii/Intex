# Security Test Plan — Cove / Lighthouse Sanctuary Platform

**Classification:** Internal  
**Date:** 2026-04-09  
**Framework:** OWASP Testing Guide v4 + CSSLP Secure SDLC

---

## 1. Scope

| In Scope | Out of Scope |
|----------|-------------|
| ASP.NET Core API (`/api/*`) | Supabase infrastructure |
| React SPA (auth, forms, routing) | Azure platform internals |
| Authentication & authorization flows | Third-party ML API |
| All OWASP Top 10 categories | Physical security |

---

## 2. Test Cases by OWASP Category

### A01 — Broken Access Control

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| AC-01 | Access resident records as Donor | Send `GET /api/residents` with Donor JWT | 403 Forbidden | ✅ Pass |
| AC-02 | Social worker requests resident not assigned to them | `GET /api/residents/{id}` with SW JWT, different SW's resident | 403 Forbidden | ✅ Pass |
| AC-03 | Anonymous caller hits admin endpoint | `DELETE /api/donations/1` with no token | 401 Unauthorized | ✅ Pass |
| AC-04 | Donate with non-existent SupporterId | `POST /api/donations` with `supporterId: 99999` | 400 Bad Request | ✅ Pass |
| AC-05 | Create resident with age out of range | `POST /api/residents` with `age: -1` | 400 Bad Request | ✅ Pass |
| AC-06 | Create resident with age > 25 | `POST /api/residents` with `age: 99` | 400 Bad Request | ✅ Pass |

### A02 — Cryptographic Failures

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| CR-01 | API accessible over plain HTTP | `curl http://api-domain/api/auth/me` | Redirect to HTTPS or connection refused | ✅ Pass |
| CR-02 | JWT uses weak algorithm | Decode JWT header, check `alg` field | `HS256` with 64-byte key | ✅ Pass |
| CR-03 | Secrets not in source control | `git log -p -- appsettings.json` | No credentials in history after cleanup commit | ✅ Pass |
| CR-04 | HSTS header present | Check response headers on API | `Strict-Transport-Security` present | ✅ Pass |

### A03 — Injection

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| IN-01 | SQL injection via supporter lookup | `GET /api/supporters/lookup?firstName=' OR '1'='1` | 404 Not Found (no data leak) | ✅ Pass |
| IN-02 | SQL injection in backfill endpoint | `POST /api/admin/backfill-social-workers` with injected SW name | No injection; parameterized query used | ✅ Pass |
| IN-03 | Stored XSS via case notes | Submit `<script>alert(1)</script>` as a case note | Tag stripped by InputSanitizer | ✅ Pass |
| IN-04 | HTML entity XSS bypass | Submit `&lt;script&gt;alert(1)&lt;/script&gt;` | Entities decoded then stripped | ✅ Pass |
| IN-05 | javascript: protocol in input | Submit `javascript:alert(1)` in a text field | Protocol removed by InputSanitizer | ✅ Pass |
| IN-06 | Open redirect via login `?redirect=` | Navigate to `/login?redirect=https://evil.com` | Redirect ignored; user sent to role home | ✅ Pass |

### A04 — Insecure Design

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| ID-01 | Rate limit on login endpoint | Send 6 POST requests to `/api/auth/login` within 1 minute from same IP | 6th request returns 429 | ✅ Pass |
| ID-02 | Rate limit on 2FA verify endpoint | Send 6 POST requests to `/api/auth/2fa/verify` within 1 minute | 6th request returns 429 | ✅ Pass |
| ID-03 | Rate limit on register endpoint | Send 6 POST requests to `/api/auth/register` within 1 minute | 6th request returns 429 | ✅ Pass |
| ID-04 | Rate limit on public donation endpoint | Send 31 POST requests to `/api/donations` within 1 minute | 31st request returns 429 | ✅ Pass |
| ID-05 | GetAll donations pagination cap | `GET /api/donations?pageSize=9999` | Returns max 500 records | ✅ Pass |

### A05 — Security Misconfiguration

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| MC-01 | Swagger not exposed in production | `GET /openapi` on production URL | 404 Not Found | ✅ Pass |
| MC-02 | X-Frame-Options header set | Check response headers | `X-Frame-Options: DENY` | ✅ Pass |
| MC-03 | X-Content-Type-Options set | Check response headers | `X-Content-Type-Options: nosniff` | ✅ Pass |
| MC-04 | Referrer-Policy set | Check response headers | `Referrer-Policy: strict-origin-when-cross-origin` | ✅ Pass |
| MC-05 | Content-Security-Policy set | Check response headers | CSP header present, no `unsafe-inline` | ✅ Pass |
| MC-06 | CORS rejects unknown origin | Send request with `Origin: https://attacker.com` | No `Access-Control-Allow-Origin` in response | ✅ Pass |
| MC-07 | CORS allows frontend origin | Send request with `Origin: https://intex-ochre.vercel.app` | `Access-Control-Allow-Origin` matches | ✅ Pass |

### A06 — Vulnerable and Outdated Components

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| VC-01 | .NET package audit | `dotnet list package --vulnerable` | No vulnerable packages | ✅ Pass |
| VC-02 | npm package audit | `npm audit` | 0 vulnerabilities | ✅ Pass |

### A07 — Identification and Authentication Failures

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| AU-01 | Account lockout after 5 bad passwords | Submit wrong password 6 times | Account locked; 6th attempt returns lockout message | ✅ Pass |
| AU-02 | Locked account stays locked for 15 minutes | Wait < 15 min after lockout, try again | Still locked | ✅ Pass |
| AU-03 | JWT revocation on logout | Login, call `POST /api/auth/logout`, reuse same JWT | 401 Unauthorized | ✅ Pass |
| AU-04 | Expired JWT rejected | Craft JWT with past `exp` claim | 401 Unauthorized | ✅ Pass |
| AU-05 | JWT with wrong issuer rejected | Craft JWT with `iss: attacker.com` | 401 Unauthorized | ✅ Pass |
| AU-06 | Password under 14 chars rejected | Register with `password: "short"` | 400 Bad Request | ✅ Pass |

### A08 — Software and Data Integrity Failures

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| SI-01 | npm packages have no known vulnerabilities | `npm audit` | 0 vulnerabilities | ✅ Pass |
| SI-02 | .NET packages have no known vulnerabilities | `dotnet list package --vulnerable` | No vulnerable packages | ✅ Pass |

### A09 — Security Logging and Monitoring Failures

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| LM-01 | Failed login is logged | Submit wrong password; check server logs | Log entry with username and IP at Warning level | ✅ Pass |
| LM-02 | Successful login is logged | Login successfully; check server logs | Log entry with username and IP at Information level | ✅ Pass |
| LM-03 | Failed 2FA attempt is logged | Submit wrong 2FA code; check server logs | Log entry with userId and IP at Warning level | ✅ Pass |
| LM-04 | Logout is logged | Call logout endpoint; check server logs | Log entry with userId at Information level | ✅ Pass |
| LM-05 | Internal errors logged, not exposed | Trigger a 500 error; check response body | Generic message in response, full detail in server log | ✅ Pass |

### A10 — Server-Side Request Forgery

| ID | Test | Method | Expected Result | Status |
|----|------|--------|----------------|--------|
| SS-01 | ML API URL is hardcoded, not user-supplied | Review `VanessaController.cs` | URL is a constant, not user input | ✅ Pass |
| SS-02 | Anthropic API call has timeout | Review `VanessaController.cs` | 30-second `CancellationTokenSource` applied | ✅ Pass |

---

## 3. Regression Test Checklist (run before each release)

```
[ ] dotnet build -- 0 errors, 0 warnings
[ ] dotnet list package --vulnerable -- no results
[ ] npm audit -- 0 vulnerabilities
[ ] Manual smoke: login → 2FA → logout → verify old JWT rejected
[ ] Manual smoke: login with wrong password 6x → confirm lockout message
[ ] Manual smoke: POST /api/donations with invalid supporterId → 400
[ ] Manual smoke: POST /api/residents with age: -1 → 400
[ ] Manual smoke: login?redirect=https://evil.com → redirects to role home
[ ] Headers check: X-Frame-Options, X-Content-Type-Options, CSP, HSTS present
```

---

## 4. Security Requirements Traceability

| Requirement | Source | Implementation | Test IDs |
|-------------|--------|---------------|----------|
| Passwords ≥ 14 characters | NIST SP 800-63B | `Program.cs` Identity options | AU-06 |
| Account lockout after 5 failures | OWASP ASVS 2.2.4 | `lockoutOnFailure: true`, 5 max attempts | AU-01, AU-02 |
| JWT must expire | OWASP ASVS 3.2.1 | 8-hour expiry | AU-04 |
| JWT revocable on logout | OWASP ASVS 3.3.1 | `ITokenBlacklist` + logout endpoint | AU-03 |
| No secrets in source control | OWASP ASVS 2.10.4 | `appsettings.Development.json` gitignored; env vars for prod | CR-03 |
| All inputs sanitized | OWASP ASVS 5.2.1 | `InputSanitizer.Sanitize()` applied at controller boundaries | IN-03–05 |
| Parameterized queries only | OWASP ASVS 5.3.4 | All raw SQL uses `DbParameter` | IN-01, IN-02 |
| Rate limiting on auth | OWASP ASVS 2.2.1 | `FixedWindowLimiter("auth")`: 5/min | ID-01–03 |
| Security headers | OWASP ASVS 14.4 | Middleware sets 5 security headers | MC-02–05 |
| Role-based access control | OWASP ASVS 4.1 | `[Authorize(Roles = "...")]` on all endpoints | AC-01–03 |
