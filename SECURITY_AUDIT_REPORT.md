# Security Audit Report

Audit scope: `C:\Users\William Francom\OneDrive\Desktop\INTEX\Intex`

Date: 2026-04-08

Method: read-only code review of backend, frontend, config, and related repo files. No source code was modified as part of the audit; this report file is the only artifact created.

## 1. Program.cs — Middleware Pipeline

### 1a. Middleware order

Status: `PARTIAL`

File: `backend/WebApplication1/WebApplication1/Program.cs`

Observed order:

1. `app.MapOpenApi()` in development or `app.UseHsts()` in production at `Program.cs:126-133`
2. `app.UseCors("AllowFrontend")` at `Program.cs:135`
3. CSP response-header middleware at `Program.cs:137-153`
4. `app.UseHttpsRedirection()` at `Program.cs:155`
5. `app.UseRouting()` at `Program.cs:156`
6. `app.UseAuthentication()` at `Program.cs:157`
7. `app.UseAuthorization()` at `Program.cs:158`
8. `app.MapControllers()` at `Program.cs:160`
9. No `app.UseStaticFiles()`
10. No `app.MapFallbackToFile(...)`

Assessment:

- `UseAuthentication()` is correctly before `UseAuthorization()`.
- `UseCors()` is present and early in the pipeline.
- `UseHttpsRedirection()` is present.
- `UseStaticFiles()` is missing.
- `MapFallbackToFile()` is missing.
- This deviates from the requested checklist order `CORS -> HTTPS Redirect -> Static Files -> Routing -> Authentication -> Authorization -> Map Controllers -> Fallback`.
- The missing static/fallback calls may be acceptable for a split frontend/backend architecture, but they do not match the checklist as written.

### 1b. Password policy

Status: `PASS`

File: `backend/WebApplication1/WebApplication1/Program.cs:30-40`

| Option | Expected | Actual |
|---|---:|---:|
| `RequiredLength` | `14` | `14` |
| `RequireDigit` | `false` | `false` |
| `RequireLowercase` | `false` | `false` |
| `RequireUppercase` | `false` | `false` |
| `RequireNonAlphanumeric` | `false` | `false` |

All required password options are explicitly set.

### 1c. SignIn options

Status: `PASS`

File: `backend/WebApplication1/WebApplication1/Program.cs:37-39`

| Option | Expected | Actual |
|---|---:|---:|
| `options.SignIn.RequireConfirmedEmail` | `false` | `false` |
| `options.SignIn.RequireConfirmedAccount` | `false` | `false` |
| `options.User.RequireUniqueEmail` | good practice | `true` |

### 1d. CSP header middleware

Status: `PARTIAL`

File: `backend/WebApplication1/WebApplication1/Program.cs:137-153`

Findings:

- Implemented as an HTTP response header via `context.Response.Headers.Append("Content-Security-Policy", ...)` at `Program.cs:139-150`.
- This is correct. It is not implemented as a `<meta>` tag.
- `unsafe-eval` is **not** present.

Observed directives:

- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `img-src 'self' data: https:`
- `font-src 'self' https://fonts.gstatic.com`
- `connect-src 'self' https://localhost:7054 http://localhost:5280 ... ws://localhost:5173 ... https://intex-ochre.vercel.app`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `base-uri 'self'`
- `object-src 'none'`

Issues:

- The policy includes many localhost and websocket development origins in `connect-src` at `Program.cs:146`.
- Those values should be removed or environment-scoped before production deployment.
- The header exists and is meaningfully restrictive, but it is broader than necessary for production.

### 1e. HTTPS redirect

Status: `PASS`

File: `backend/WebApplication1/WebApplication1/Program.cs:155`

`app.UseHttpsRedirection()` is present.

### 1f. HSTS

Status: `PASS`

File: `backend/WebApplication1/WebApplication1/Program.cs:130-133`

`app.UseHsts()` is present inside the non-development branch.

### 1g. Cookie configuration

Status: `NOT FOUND`

Relevant files:

- `backend/WebApplication1/WebApplication1/Program.cs:52-69`
- `frontend/intex/src/context/AuthContext.tsx:24-60`

Findings:

- There is no auth cookie configuration in `Program.cs`.
- The app uses JWT bearer authentication via `AddJwtBearer(...)` at `Program.cs:52-69`.
- The frontend persists the JWT in `localStorage` under `cove_token` at `AuthContext.tsx:26`, `AuthContext.tsx:45`, and `AuthContext.tsx:54`.

Requested cookie settings could not be reported because no auth cookie exists:

- `HttpOnly`: not configured
- `Secure`: not configured
- `SameSite`: not configured
- `ExpireTimeSpan`: not configured

Security note:

- This is not a rubric violation by itself, but it means there is no `HttpOnly` protection for the auth token because the token is stored in browser-accessible `localStorage`.

## 2. User Seeding

### 2a. Roles created

Status: `PASS`

File: `backend/WebApplication1/WebApplication1/Program.cs:254-265`

Seeded roles:

- `Admin`
- `Donor`

This satisfies the minimum requirement.

### 2b. Users created

Status: `PASS`

File: `backend/WebApplication1/WebApplication1/Program.cs:267-381`

| Seed user | Username | Email | Intended role | `EmailConfirmed = true` | Password source | 14+ char check |
|---|---|---|---|---|---|---|
| Admin | `admin` | `admin@intex.com` | `Admin` | Yes at `Program.cs:301-306` | `SeedUsers:Admin:Password` from config at `Program.cs:269-273` | Not visible in source; enforced by Identity policy |
| Donor | `donor` | `donor@intex.com` | `Donor` | Yes when created at `Program.cs:301-306` | `SeedUsers:Donor:Password` from config at `Program.cs:274-278` | Not visible in source; enforced by Identity policy |
| Basic | `basicuser` | `user@intex.com` | None | Yes when created at `Program.cs:301-306` | `SeedUsers:Basic:Password` from config at `Program.cs:279-283` | Not visible in source; enforced by Identity policy |

Assessment:

- Passwords are not hardcoded in source for these seed users.
- Seed passwords come from configuration, intended for user-secrets or environment variables.
- Exact password length cannot be inspected from the repo because values are external, but `CreateAsync` and `AddPasswordAsync` will be constrained by the configured Identity policy.

### 2c. Seeding execution

Status: `PASS`

File: `backend/WebApplication1/WebApplication1/Program.cs:113-124`

The seeding block is executed:

- after `var app = builder.Build();` at `Program.cs:113`
- inside `using (var scope = app.Services.CreateScope())` at `Program.cs:115`
- before `app.Run();` at `Program.cs:162`

Database preparation and seeding calls:

- `TryApplyMigrationsAsync(db, logger)` at `Program.cs:121`
- `EnsureIdentitySchemaAsync(db)` at `Program.cs:122`
- `SeedIdentityAsync(...)` at `Program.cs:123`

## 3. Controller Authorization Audit

### 3a-3c. Summary Table

| Controller | File | Class Auth | Method/Auth Summary | Status | Issues |
|---|---|---|---|---|---|
| `AdminController` | `backend/WebApplication1/WebApplication1/Controllers/AdminController.cs` | `[Authorize(Roles = "Admin")]` at `:14` | `POST seed-social-worker-users` at `:41-42`; `POST backfill-social-workers` at `:108-109` | `PASS` | None for authorization |
| `AssessmentsController` | `backend/WebApplication1/WebApplication1/Controllers/AssessmentsController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:25-26`; `POST` `[Authorize(Roles = "Admin")]` at `:49-51` | `PASS` | None |
| `AuthController` | `backend/WebApplication1/WebApplication1/Controllers/AuthController.cs` | No class-level auth | `POST login` `[AllowAnonymous]` at `:38-40`; `POST register` `[AllowAnonymous]` at `:80-82`; `GET me` `[AllowAnonymous]` at `:181-183` | `PASS` | Login/register/me remain usable |
| `DonationAllocationsController` | `backend/WebApplication1/WebApplication1/Controllers/DonationAllocationsController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:16-17`; `GET summary` at `:23-24` | `PASS` | None |
| `DonationsController` | `backend/WebApplication1/WebApplication1/Controllers/DonationsController.cs` | `[Authorize]` at `:10` | `POST` `[Authorize(Roles = "Donor,Admin")]` at `:17-19`; `GET total` `[AllowAnonymous]` at `:57-59`; `GET` `[Authorize(Roles = "Admin")]` at `:65-67`; `GET by-supporter` donor/admin at `:95-97`; `GET my` donor/admin at `:126-128`; admin summaries at `:157-179` | `FAIL` | `POST /api/donations` is not admin-only. This violates the audit rule that create/update/delete actions should be admin-only. See `DonationsController.cs:17-19`. |
| `EducationRecordsController` | `backend/WebApplication1/WebApplication1/Controllers/EducationRecordsController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21` | `PASS` | None |
| `HealthWellbeingRecordsController` | `backend/WebApplication1/WebApplication1/Controllers/HealthWellbeingRecordsController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21` | `PASS` | None |
| `HomeVisitationsController` | `backend/WebApplication1/WebApplication1/Controllers/HomeVisitationsController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21`; `GET {id}` at `:71-72`; `POST` admin at `:119-121`; `PUT` admin at `:128-130` | `PASS` | None |
| `IncidentReportsController` | `backend/WebApplication1/WebApplication1/Controllers/IncidentReportsController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21`; `GET {id}` at `:39-40`; `PUT` admin at `:56-58` | `PASS` | None |
| `InterventionPlansController` | `backend/WebApplication1/WebApplication1/Controllers/InterventionPlansController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21`; `GET {id}` at `:41-42`; `POST` admin at `:61-63`; `PUT` admin at `:72-74`; `GET upcoming` at `:93-94` | `PASS` | None |
| `NotificationsController` | `backend/WebApplication1/WebApplication1/Controllers/NotificationsController.cs` | `[Authorize]` at `:10` | `GET unread-count` at `:24-25`; `GET` at `:36-37`; `PATCH read` at `:50-51`; `PATCH mark-all-read` at `:62-63` | `PARTIAL` | Patch endpoints modify data but are not admin-only. They are owner-scoped, which is defensible, but stricter rubric interpretation could object. |
| `ProcessRecordingsController` | `backend/WebApplication1/WebApplication1/Controllers/ProcessRecordingsController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21`; `GET {id}` at `:71-72`; `POST` admin at `:119-121`; `PUT` admin at `:128-130` | `PASS` | None |
| `ResidentsController` | `backend/WebApplication1/WebApplication1/Controllers/ResidentsController.cs` | `[Authorize(Roles = "Admin")]` at `:10` | `GET` at `:21-22`; `GET {id}` at `:37-38`; `GET public-counts` `[AllowAnonymous]` at `:52-54`; `GET next-code` admin at `:69-71`; `POST` admin at `:91-93`; `PATCH/PUT` admin at `:144-147` | `PASS` | Public counts endpoint is a valid public aggregate endpoint |
| `SafehouseMonthlyMetricsController` | `backend/WebApplication1/WebApplication1/Controllers/SafehouseMonthlyMetricsController.cs` | `[Authorize]` at `:9` | `GET` admin at `:16-18`; `GET latest` `[AllowAnonymous]` at `:24-26` | `PASS` | Public latest metrics appears consistent with public impact reporting |
| `SafehousesController` | `backend/WebApplication1/WebApplication1/Controllers/SafehousesController.cs` | `[Authorize]` at `:9` | `GET` `[AllowAnonymous]` at `:20-22` | `FAIL` | `GET /api/safehouses` exposes full safehouse records publicly. This endpoint is not one of the clearly allowed public exceptions in the checklist. |
| `SocialWorkersController` | `backend/WebApplication1/WebApplication1/Controllers/SocialWorkersController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21`; `GET {id}` at `:68-69`; `POST` admin at `:76-78` | `PASS` | None |
| `SupportersController` | `backend/WebApplication1/WebApplication1/Controllers/SupportersController.cs` | `[Authorize]` at `:10` | `GET` admin at `:19-21`; `POST upsert` donor/admin at `:29-31`; `GET me` donor/admin at `:83-85`; `PUT me` donor/admin at `:106-108`; `POST` admin at `:146-148`; `GET lookup` admin at `:156-158`; `GET lookup-by-email` donor/admin at `:177-179` | `FAIL` | `POST /api/supporters/upsert` and `PUT /api/supporters/me` are not admin-only. They are self-service donor endpoints, but they violate the strict admin-only CUD rule in the checklist. |
| `UsersController` | `backend/WebApplication1/WebApplication1/Controllers/UsersController.cs` | `[Authorize(Roles = "Admin")]` at `:9` | `GET` at `:20-21` | `PASS` | None |
| `VanessaController` | `backend/WebApplication1/WebApplication1/Controllers/VanessaController.cs` | `[Authorize(Roles = "Admin")]` at `:13` | `POST chat` at `:49-50` | `PASS` | None |
| `WeatherForecastController` | `backend/WebApplication1/WebApplication1/Controllers/WeatherForecastController.cs` | `[Authorize]` at `:7` | `GET` at `:23` | `PASS` | None |

### Controller audit conclusions

Status: `FAIL`

Primary issues:

1. `SafehousesController.GetSafehouses()` is public at `SafehousesController.cs:20-24`.
2. `DonationsController.Create()` allows `Donor,Admin` at `DonationsController.cs:17-19`.
3. `SupportersController.Upsert()` allows `Donor,Admin` at `SupportersController.cs:29-31`.
4. `SupportersController.UpdateMyProfile()` allows `Donor,Admin` at `SupportersController.cs:106-108`.

These self-service donor endpoints may be intentional business decisions, but they do not strictly satisfy the audit checklist's admin-only CUD rule.

## 4. Frontend Auth & Delete Confirmation Audit

### 4a. API service / fetch calls

Status: `PASS`

Relevant files:

- `frontend/intex/src/services/apiService.ts:9-25`
- `frontend/intex/src/services/apiService.ts:211-263`
- `frontend/intex/src/services/authService.ts:66-94`
- `frontend/intex/src/services/socialWorkerService.ts:24-29`, `:65-72`, `:94-101`, `:136-143`, `:174-181`, `:210-217`, `:228-235`

Findings:

- `apiService.ts` sets `credentials: 'include'` on all its fetch wrappers.
- `authService.ts` sets `credentials: 'include'` on login, register, and me.
- `socialWorkerService.ts` also sets `credentials: 'include'` on all API calls.
- One frontend fetch to `/data/philippines-regions.json` in `SafehouseLocationsPage.tsx:198` does not use credentials, which is appropriate because it is a static local asset.
- `mlApi.ts` does not use `credentials: 'include'` at `mlApi.ts:10-14` and `mlApi.ts:44-46`; this appears to be an external ML service call rather than the protected main API.

### 4b. Route protection

Status: `PASS`

Relevant files:

- `frontend/intex/src/App.tsx:45-102`
- `frontend/intex/src/components/common/ProtectedRoute.tsx:15-53`

Public routes:

- `/` at `App.tsx:47`
- `/login` at `App.tsx:48`
- `/register` at `App.tsx:49`
- `/donate` at `App.tsx:50`
- `/privacy` at `App.tsx:51`
- `/impact` at `App.tsx:52`

Protected routes:

- Social worker/admin routes under `/socialworker/dashboard` at `App.tsx:56-68`
- Donor/admin routes under `/donor` at `App.tsx:71-79`
- Admin routes under `/admin` at `App.tsx:82-102`

Redirect behavior:

- Unauthenticated users are redirected to login at `ProtectedRoute.tsx:43-45`.
- Users with the wrong role are redirected to their own role home at `ProtectedRoute.tsx:48-50`.

Required public pages remain publicly accessible:

- Home: Yes
- Privacy policy: Yes
- Login: Yes
- Register: Yes

### 4c. Delete confirmation

Status: `PARTIAL`

Relevant files:

- `frontend/intex/src/components/common/DeleteConfirmModal.tsx:1-72`
- `frontend/intex/src/pages/socialworker/ResidentDetailPage.tsx:699-714`

Table:

| Component/Page | Delete Target | Has Confirmation? | Type |
|---|---|---|---|
| `ResidentDetailPage` | Resident archive/reactivate action | Yes | Custom modal (`DeleteConfirmModal`) |
| Other frontend pages | No actual `DELETE` handlers or `DELETE` fetch calls found in active React code | Not demonstrable | None found |

Assessment:

- The reusable confirmation modal exists.
- It is actively used for resident archive/reactivate.
- No actual `DELETE` API calls or delete button handlers were found elsewhere in the current React app.
- Because the broader CRUD UI does not currently expose delete actions across the other entity pages, full rubric coverage cannot be demonstrated from the current codebase.

## 5. Credentials Audit

### 5a-5b. Findings

Status: `FAIL`

| Finding | File / Line | Assessment |
|---|---|---|
| Seed admin/donor/basic passwords are loaded from configuration, not hardcoded | `backend/WebApplication1/WebApplication1/Program.cs:269-283` | `PASS` |
| JWT key is loaded from configuration, not hardcoded | `backend/WebApplication1/WebApplication1/Program.cs:42-50` | `PASS` |
| Anthropic API key is loaded from configuration, not hardcoded | `backend/WebApplication1/WebApplication1/Controllers/VanessaController.cs:52-71` | `PASS` |
| `appsettings.json` contains empty placeholders for `ConnectionStrings:DefaultConnection` and `Anthropic.ApiKey` | `backend/WebApplication1/WebApplication1/appsettings.json:9-17` | `PASS` placeholder only |
| Local frontend `.env` contains only `VITE_API_URL=http://localhost:5280` | `frontend/intex/.env:1` | `PASS` not a secret |
| `AdminController` returns `defaultPassword` in the API response body | `backend/WebApplication1/WebApplication1/Controllers/AdminController.cs:98-105` | `FAIL` real credential exposure risk; the password value comes from secrets/env but is returned to the caller |
| `AdminController` includes a comment showing example password text `"Password123!"` | `backend/WebApplication1/WebApplication1/Controllers/AdminController.cs:38-40` | `PARTIAL` comment only, not an active secret |
| Unrelated training project contains SQLite connection strings without credentials | `SecurityIntex/RootkitIdentityW26/backend/RootkitAuth.API/appsettings.json:11-12` | `PASS` local file paths only, no username/password |

Notes:

- No hardcoded production API keys or database passwords were found in the current main app source tree.
- The most important credential problem is not hardcoding, but runtime disclosure: `AdminController` returns the configured social worker seed password in the HTTP response.

### 5c. .gitignore check

Status: `PARTIAL`

File: `.gitignore`

| Entry | Present? | Lines |
|---|---|---|
| `.env` | Yes | `.gitignore:12` |
| `appsettings.Development.json` | Yes | `.gitignore:11` |
| `*.db` | No | not found |

Assessment:

- `.env` is ignored.
- `appsettings.Development.json` is ignored.
- `*.db` is not ignored. That matters if SQLite files are introduced later, though the current main app uses PostgreSQL.

## 6. Privacy Policy & Cookie Consent

### 6a. Privacy policy page

Status: `PARTIAL`

Relevant files:

- Route: `frontend/intex/src/App.tsx:51`
- Page: `frontend/intex/src/pages/public/PrivacyPolicyPage.tsx:3-217`
- Footer link: `frontend/intex/src/components/public/Footer.tsx:6-9`
- Footer inclusion: `frontend/intex/src/components/common/PublicLayout.tsx:8-14`

Findings:

- Route is `/privacy`.
- It is publicly accessible because it lives in the unguarded public route group at `App.tsx:46-53`.
- It is linked from the public footer at `Footer.tsx:8`.
- That footer is included in `PublicLayout`, so the link appears on public pages that use the layout.

Content assessment:

- The content is partially tailored to the app:
  - mentions a nonprofit child welfare platform in the Philippines at `PrivacyPolicyPage.tsx:10-12`
  - mentions donors, registered users, social workers, and resident interaction records at `:26-45`
- However, it is explicitly a placeholder at `PrivacyPolicyPage.tsx:8-12`.
- It does not fully satisfy the requested specificity:
  - no clear reference to Philippine social welfare agencies or reporting duties
  - no specific mention of education records as a collected category
  - no specific mention of health and wellbeing records as a separate category
  - no strong statement that minors' sensitive data is handled with heightened protections
  - no clearly tailored legal-basis language tied to Philippine child welfare law

### 6b. Cookie consent banner

Status: `PARTIAL`

Relevant files:

- Active banner usage: `frontend/intex/src/App.tsx:43`
- Active component: `frontend/intex/src/components/common/CookieConsentBanner.tsx:13-59`
- Cookie helpers: `frontend/intex/src/utils/cookies.ts:1-20`
- Functional gating via theme: `frontend/intex/src/context/ThemeContext.tsx:20-29`, `:43-60`

Findings:

- Checks for an existing consent cookie on mount at `CookieConsentBanner.tsx:16-20`.
- Shows two choices:
  - `Accept All` at `CookieConsentBanner.tsx:45-50`
  - `Necessary Only` at `CookieConsentBanner.tsx:51-56`
- Clicking either choice sets a consent cookie via `setPersistentCookie(...)` at `CookieConsentBanner.tsx:22-24`.
- Clicking decline also deletes the theme cookie at `CookieConsentBanner.tsx:25-27`.
- Banner hides after a choice at `CookieConsentBanner.tsx:29-30`.
- Banner will reappear on refresh if no consent cookie exists because visibility is based on `getCookie(...) === null` at `CookieConsentBanner.tsx:16-20`.
- The cookie is browser-accessible because it is set by `document.cookie` in `cookies.ts:15-20`.
- Functional gating exists: optional theme persistence is only allowed when consent is `accepted` at `ThemeContext.tsx:24-29`.

Cookie attributes:

- `SameSite=Lax` at `cookies.ts:16` and `cookies.ts:20`
- `path=/` at `cookies.ts:16` and `cookies.ts:20`
- `max-age=31536000` at `cookies.ts:16`
- `Secure` is conditional and only added on HTTPS at `cookies.ts:5-7`

Why this is `PARTIAL` instead of `PASS`:

- The implementation is functionally real, not cosmetic.
- However, the required `Secure` attribute is not unconditional in code; it is only added when the page is served over HTTPS.
- There is also a legacy unused component at `frontend/intex/src/components/common/CookieConsent.tsx:1-53`, which may cause confusion during maintenance even though it does not appear to be mounted.

## 7. Dark/Light Mode (Additional Feature)

### 7a. Theme toggle

Status: `PASS`

Relevant files:

- Toggle component: `frontend/intex/src/components/common/ThemeToggle.tsx:7-19`
- Theme context: `frontend/intex/src/context/ThemeContext.tsx:32-67`
- Cookie helpers: `frontend/intex/src/utils/cookies.ts:1-20`
- CSS: `frontend/intex/src/styles/theme.css:1-20`
- CSS import: `frontend/intex/src/main.tsx:2-4`

Findings:

- Theme toggle exists.
- The cookie name is `theme` via `THEME_COOKIE_NAME = 'theme'` at `cookies.ts:2`.
- Cookie is browser-accessible, not `HttpOnly`, because it is set via `document.cookie` at `cookies.ts:15-20`.
- Cookie attributes:
  - `path=/`
  - `max-age=31536000`
  - `SameSite=Lax`
  - conditional `Secure` on HTTPS
- Theme is read from cookie on load at `ThemeContext.tsx:33-36`.
- Theme is applied to the document root via `document.documentElement.setAttribute('data-theme', theme)` at `ThemeContext.tsx:38-41`.
- Actual dark-mode CSS variables exist in `theme.css:1-20`.
- The stylesheet is imported in `main.tsx:2-4`.
- Theme persistence is conditional on cookie consent:
  - if consent accepted, theme cookie persists at `ThemeContext.tsx:24-29`
  - if consent declined, the theme cookie is deleted

## 8. Additional Security Features Inventory

Status: `PASS`

Found features:

1. HSTS
   - `backend/WebApplication1/WebApplication1/Program.cs:130-133`
   - `app.UseHsts()` is enabled outside development.

2. Authorization fallback policy
   - `backend/WebApplication1/WebApplication1/Program.cs:71-76`
   - Configures a fallback policy requiring authenticated users unless an endpoint explicitly opts out.

3. Input sanitization for resident updates
   - `backend/WebApplication1/WebApplication1/Controllers/ResidentsController.cs:157-169`
   - `backend/WebApplication1/WebApplication1/Controllers/ResidentsController.cs:189-198`
   - `AssignedSocialWorker`, `CurrentRiskLevel`, and `CaseStatus` are trimmed through `SanitizeOptionalText(...)` before persistence.

4. Extra CSP hardening directives
   - `backend/WebApplication1/WebApplication1/Program.cs:147-150`
   - Includes `frame-ancestors 'none'`, `base-uri 'self'`, and `object-src 'none'`.

Not found:

- Google auth / Facebook auth
- MFA / 2FA implementation
- Rate limiting
- Antiforgery tokens
- `X-Frame-Options` header
- `X-Content-Type-Options` header

## Executive Summary

### 1. Total rubric points at risk

Estimated points at risk from current `FAIL` and `PARTIAL` findings:

- `Pages/API endpoints require auth` — `1 pt`
  - `SafehousesController.GetSafehouses()` is public at `SafehousesController.cs:20-24`
- `RBAC — admin only CUD` — `1.5 pts`
  - `DonationsController.Create()` allows `Donor,Admin` at `DonationsController.cs:17-19`
  - `SupportersController.Upsert()` allows `Donor,Admin` at `SupportersController.cs:29-31`
  - `SupportersController.UpdateMyProfile()` allows `Donor,Admin` at `SupportersController.cs:106-108`
- `Delete confirmation` — `1 pt`
  - only one destructive action is confirmed; broad app-wide delete coverage is not demonstrated
- `Credentials secure` — `1 pt`
  - `AdminController` returns `defaultPassword` in the API response at `AdminController.cs:98-105`
- `Privacy policy` — `1 pt`
  - privacy page is still explicit placeholder content and only partially tailored
- `CSP header` — `2 pts`
  - CSP header exists, but production policy still contains numerous localhost/ws development origins

Estimated total at risk: `7.5 pts`

Not included in the total:

- `Deployed publicly` (`4 pts`) cannot be verified from repo contents alone.

### 2. Critical fixes needed before pushing

1. Remove the password leak from `AdminController`.
   - File: `backend/WebApplication1/WebApplication1/Controllers/AdminController.cs:98-105`
   - Reason: exposes a configured secret directly in an API response.

2. Decide whether donor self-service endpoints are allowed by the grading rubric.
   - Files:
     - `backend/WebApplication1/WebApplication1/Controllers/DonationsController.cs:17-19`
     - `backend/WebApplication1/WebApplication1/Controllers/SupportersController.cs:29-31`
     - `backend/WebApplication1/WebApplication1/Controllers/SupportersController.cs:106-108`
   - Reason: these are legitimate product features, but they fail the strict audit rule that CUD endpoints should be admin-only.

3. Lock down or justify the public safehouses endpoint.
   - File: `backend/WebApplication1/WebApplication1/Controllers/SafehousesController.cs:20-24`
   - Reason: safehouse data is publicly accessible but is not one of the clearly allowed public exceptions in the checklist.

4. Replace the placeholder privacy policy with final tailored content.
   - File: `frontend/intex/src/pages/public/PrivacyPolicyPage.tsx:8-12`
   - Reason: placeholder language is obvious and several required app-specific disclosures are still missing.

5. Clean the production CSP.
   - File: `backend/WebApplication1/WebApplication1/Program.cs:141-150`
   - Reason: the header is present, but dev-only localhost and websocket entries should not ship unchanged.

### 3. Things that are working well

- Identity password policy matches the required NIST-style configuration exactly.
- Sign-in confirmation requirements are disabled correctly for this project.
- Startup seeding is correctly placed after `Build()` and before `Run()`.
- JWT auth, authentication middleware, and authorization middleware are all wired in the correct relative order.
- Route protection in React is solid and public pages remain publicly accessible.
- Cookie consent is functional and actually gates the optional theme cookie.
- Theme toggle is implemented correctly and backed by real CSS.
- CSP is implemented as a real HTTP response header, not a meta tag.
- HTTPS redirect and HSTS are both present.
