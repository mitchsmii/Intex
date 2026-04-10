# Security Requirements — Cove / Lighthouse Sanctuary Platform

**Classification:** Internal  
**Date:** 2026-04-09  
**Phase:** Design & Requirements (SDLC Phase 1)  
**Standards:** OWASP ASVS v4.0, NIST SP 800-63B, ISO 27001

This document captures security requirements defined *before* implementation — demonstrating
that security is designed in, not bolted on. Each requirement is traceable to a standard,
an implementation location, and a test case in `SECURITY_TEST_PLAN.md`.

---

## 1. Authentication Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| AUTH-01 | Users must authenticate with username and password before accessing protected resources | ASVS 2.1.1 | `AuthController.Login` | AU-01 |
| AUTH-02 | Passwords must be at least 14 characters | NIST 800-63B §5.1.1 | `Program.cs` Identity options | AU-06 |
| AUTH-03 | Accounts must lock after 5 consecutive failed login attempts | ASVS 2.2.4 | `lockoutOnFailure: true`, max 5 attempts | AU-01 |
| AUTH-04 | Locked accounts must remain locked for at least 15 minutes | ASVS 2.2.4 | `DefaultLockoutTimeSpan = 15 min` | AU-02 |
| AUTH-05 | All failed login attempts must be logged with username and source IP | ASVS 7.2.1 | `_logger.LogWarning` in `AuthController` | LM-01 |
| AUTH-06 | Successful logins must be logged with username and source IP | ASVS 7.2.1 | `_logger.LogInformation` in `AuthController` | LM-02 |
| AUTH-07 | 2FA must be supported for all user accounts | ASVS 2.8 | Email OTP via `GenerateTwoFactorTokenAsync` | AU-07 |
| AUTH-08 | 2FA verification attempts must be rate-limited | ASVS 2.2.1 | `FixedWindowLimiter("auth")` on `/auth/2fa/verify` | ID-02 |
| AUTH-09 | Sessions must be revocable by the user (logout) | ASVS 3.3.1 | `ITokenBlacklist` + `POST /auth/logout` | AU-03 |
| AUTH-10 | JWT tokens must expire within 8 hours | ASVS 3.2.1 | `expires: DateTime.UtcNow.AddHours(8)` | AU-04 |
| AUTH-11 | JWT tokens must be signed with a secret of at least 64 bytes | ASVS 3.5.3 | `HS256` with 64-byte key from environment | CR-02 |
| AUTH-12 | Auth endpoints must be rate-limited to prevent brute force | ASVS 2.2.1 | 5 req/min/IP on login, register, 2FA | ID-01–03 |

---

## 2. Authorization Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| AUTHZ-01 | All API endpoints must require authentication unless explicitly marked public | ASVS 4.1.1 | `[Authorize]` on all controllers | AC-03 |
| AUTHZ-02 | Admin-only operations must require the Admin role | ASVS 4.1.2 | `[Authorize(Roles = "Admin")]` | AC-01 |
| AUTHZ-03 | Social workers must only access residents assigned to them | ASVS 4.1.3 | `AssignedSocialWorker == username` filter | AC-02 |
| AUTHZ-04 | Donors must only access their own supporter and donation records | ASVS 4.1.3 | `lookup-by-email` requires authenticated user | AC-04 |
| AUTHZ-05 | Anonymous users may only access explicitly public endpoints | ASVS 4.1.1 | `[AllowAnonymous]` used sparingly with rate limiting | AC-03 |

---

## 3. Input Validation Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| INP-01 | All user-supplied strings must be sanitized before storage | ASVS 5.2.1 | `InputSanitizer.Sanitize()` applied at controller boundary | IN-03 |
| INP-02 | HTML tags must be stripped from all text inputs | ASVS 5.2.1 | `HtmlTagPattern.Replace` in `InputSanitizer` | IN-03 |
| INP-03 | HTML entities must be decoded before sanitization to prevent bypass | ASVS 5.2.1 | `WebUtility.HtmlDecode` before stripping | IN-04 |
| INP-04 | `javascript:` protocol must be blocked in all inputs | ASVS 5.2.1 | `DangerousProtocol.Replace` in `InputSanitizer` | IN-05 |
| INP-05 | All database queries must use parameterized queries or ORM | ASVS 5.3.4 | EF Core + `DbParameter` for all raw SQL | IN-01, IN-02 |
| INP-06 | Redirect parameters must be validated as relative paths only | ASVS 5.1.5 | `startsWith('/')` + no `://` check in `LoginPage.tsx` | IN-06 |
| INP-07 | Numeric fields must be validated within a domain-appropriate range | ASVS 5.1.3 | Age validated 0–25 in `ResidentsController` | AC-05, AC-06 |
| INP-08 | Foreign key references must be validated to exist before use | ASVS 5.1.3 | `SupporterId` existence check in `DonationsController` | AC-04 |

---

## 4. Data Protection Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| DATA-01 | All secrets must be stored outside source control | ASVS 2.10.4 | `appsettings.Development.json` gitignored; prod uses env vars | CR-03 |
| DATA-02 | All data in transit must be encrypted with TLS 1.2+ | ASVS 9.1.1 | Azure App Service + Vercel enforce HTTPS | CR-01 |
| DATA-03 | HTTPS must be enforced with HSTS | ASVS 9.1.1 | `max-age=31536000; includeSubDomains; preload` on frontend | CR-04 |
| DATA-04 | Sensitive data must not appear in error messages returned to clients | ASVS 7.4.1 | Generic errors returned; details logged server-side | LM-05 |
| DATA-05 | API responses must not expose internal stack traces | ASVS 7.4.1 | `catch` blocks return generic messages only | LM-05 |

---

## 5. Session Management Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| SESS-01 | Session tokens must be unique per login (include `jti` claim) | ASVS 3.2.2 | `Guid.NewGuid()` as `jti` in `GenerateJwtToken` | AU-03 |
| SESS-02 | Logout must immediately invalidate the session token | ASVS 3.3.1 | `ITokenBlacklist.Revoke(jti, expiry)` on logout | AU-03 |
| SESS-03 | Revoked tokens must be rejected on subsequent requests | ASVS 3.3.1 | `OnTokenValidated` checks blacklist on every request | AU-03 |

---

## 6. Security Headers Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| HDR-01 | Responses must include `X-Frame-Options: DENY` | ASVS 14.4.2 | API middleware + `vercel.json` | MC-02 |
| HDR-02 | Responses must include `X-Content-Type-Options: nosniff` | ASVS 14.4.3 | API middleware + `vercel.json` | MC-03 |
| HDR-03 | Responses must include a restrictive `Content-Security-Policy` | ASVS 14.4.6 | API middleware + `vercel.json` | MC-05 |
| HDR-04 | `Referrer-Policy` must be set to limit information leakage | ASVS 14.4.4 | API middleware + `vercel.json` | MC-04 |
| HDR-05 | `Strict-Transport-Security` must be set on all responses | ASVS 9.1.1 | `app.UseHsts()` (prod) + `vercel.json` | CR-04 |
| HDR-06 | `Permissions-Policy` must disable unused browser features | ASVS 14.4 | API middleware + `vercel.json` | MC-07 |

---

## 7. Rate Limiting & Availability Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| RATE-01 | Authentication endpoints must limit to 5 requests/min per IP | ASVS 2.2.1 | `FixedWindowLimiter("auth")` | ID-01–03 |
| RATE-02 | Anonymous public endpoints must limit to 30 requests/min per IP | ASVS 2.2.1 | `FixedWindowLimiter("public")` | ID-04 |
| RATE-03 | Paginated endpoints must cap maximum page size at 500 records | ASVS 11.1 | `pageSize = Math.Min(pageSize, 500)` in `DonationsController` | ID-05 |
| RATE-04 | External API calls must time out within 30 seconds | ASVS 11.1 | `CancellationTokenSource(30s)` in `VanessaController` | SS-02 |

---

## 8. Logging & Monitoring Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| LOG-01 | All authentication events must be logged (success and failure) | ASVS 7.2.1 | `ILogger` in `AuthController` | LM-01–04 |
| LOG-02 | Logs must include sufficient context (user ID, IP, timestamp) | ASVS 7.2.2 | Structured logging with named parameters | LM-01 |
| LOG-03 | ML prediction failures must be logged with model name | ASVS 7.2.1 | `_logger.LogError` in `MlPredictionsController` | LM-05 |
| LOG-04 | Admin backfill failures must be logged | ASVS 7.2.1 | `_logger.LogError` in `AdminController` | LM-05 |

---

## 9. Supply Chain Requirements

| ID | Requirement | Standard | Implementation | Test |
|----|-------------|----------|----------------|------|
| SUPP-01 | CI/CD pipeline must fail if vulnerable .NET packages are detected | ASVS 14.2.1 | `dotnet list package --vulnerable` in GitHub Actions | VC-01 |
| SUPP-02 | CI/CD pipeline must fail if vulnerable npm packages are detected | ASVS 14.2.1 | `npm audit --audit-level=moderate` in GitHub Actions | VC-02 |
| SUPP-03 | Security scan must run before build and block deployment on failure | ASVS 14.2.1 | `security-scan` job with `needs: security-scan` on build | VC-01, VC-02 |
