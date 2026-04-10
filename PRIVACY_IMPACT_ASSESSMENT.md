# Privacy Impact Assessment — Cove / Lighthouse Sanctuary Platform

**Classification:** Internal — Restricted  
**Date:** 2026-04-09  
**Applicable Law:** Philippine Data Privacy Act of 2012 (Republic Act No. 10173)  
**Data Controller:** Lighthouse Sanctuary (501c3 nonprofit, Philippines)  
**System:** Cove web platform

---

## 1. Purpose of Assessment

This PIA documents the personal data processed by the Cove platform, assesses privacy risks,
and records the technical and organizational controls in place. It is required as part of the
Secure SDLC and satisfies the National Privacy Commission's (NPC) accountability requirement
for systems processing sensitive personal information, particularly data involving minors.

---

## 2. Data Inventory

### 2.1 Resident Data (Sensitive Personal Information — Highest Classification)

| Data Element | Sensitivity | Stored Location | Retention |
|-------------|-------------|----------------|-----------|
| Internal case code (LS-XXXX) | High | `residents` table | Indefinite (case record) |
| Sex / date of birth / age | High | `residents` table | Indefinite |
| Date of admission / discharge | High | `residents` table | Indefinite |
| Case category (abuse type) | **Critical** | `residents` table | Indefinite |
| Sub-categories (trafficking, OSAEC, etc.) | **Critical** | `residents` table | Indefinite |
| Assigned social worker | High | `residents` table | Indefinite |
| Risk level (Low/Medium/High/Critical) | **Critical** | `residents` table | Indefinite |
| Reintegration status | High | `residents` table | Indefinite |
| Case notes (process recordings) | **Critical** | `process_recordings` table | Indefinite |
| Health & wellbeing records | **Critical** | `health_wellbeing_records` table | Indefinite |
| Education records | High | `education_records` table | Indefinite |
| Incident reports | **Critical** | `incident_reports` table | Indefinite |
| Home visitation records | High | `home_visitations` table | Indefinite |
| Intervention plans | High | `intervention_plans` table | Indefinite |

**Legal basis:** Processing is necessary for the legitimate activities of a nonprofit organization
(RA 10173 §4(b)) and is required for social welfare services mandated by law.

**Special obligation:** Resident data concerns children and involves sensitive personal information
(RA 10173 §3(l): medical/health, sexual life, legal proceedings). This requires heightened
protection and triggers the NPC's mandatory breach notification requirement.

### 2.2 Supporter / Donor Data (Personal Information)

| Data Element | Sensitivity | Stored Location | Retention |
|-------------|-------------|----------------|-----------|
| First name, last name | Medium | `supporters` table | Indefinite |
| Email address | Medium | `supporters` table | Indefinite |
| Phone number | Medium | `supporters` table | Indefinite |
| Display name | Low | `supporters` table | Indefinite |
| Donation amounts and dates | Medium | `donations` table | Indefinite (financial record) |
| Donation type / campaign | Low | `donations` table | Indefinite |

**Legal basis:** Consent (donor voluntarily provides information to make a donation).

### 2.3 User Account Data (Authentication)

| Data Element | Sensitivity | Stored Location | Retention |
|-------------|-------------|----------------|-----------|
| Username | Medium | `AspNetUsers` table | Until account deleted |
| Email address | Medium | `AspNetUsers` table | Until account deleted |
| Password hash (bcrypt) | High | `AspNetUsers` table | Until account deleted |
| Failed login count | Low | `AspNetUsers` table | Rolling (reset on success) |
| Account lockout timestamp | Low | `AspNetUsers` table | Transient |
| JWT `jti` (revocation list) | Low | In-memory cache | Until token expiry |

---

## 3. Data Flow Diagram

```
[Donor Browser]
    │  HTTPS (TLS 1.2+)
    ▼
[Vercel CDN — React SPA]
    │  HTTPS Bearer JWT
    ▼
[Azure App Service — ASP.NET Core API]
    │  TLS PostgreSQL connection
    ▼
[Supabase — PostgreSQL]
    (AWS us-east-1)

[Social Worker / Admin Browser] ──► same path ──► same DB

External services:
  API ──► Anthropic Claude API   (case-related prompts — NO PII included)
  API ──► Lighthouse ML API      (anonymized feature vectors — no names/IDs in payload)
```

---

## 4. Privacy Risk Assessment

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| PR-01 | Unauthorized access to resident case records | Medium | Critical | Role-based access (Admin/SW only); social workers see only assigned residents |
| PR-02 | Database credential leak exposes all data | Low | Critical | Credentials in env vars (gitignored); rotate procedure in `INCIDENT_RESPONSE.md` |
| PR-03 | Insider threat — social worker accesses other cases | Low | High | DB-level filtering by `assigned_social_worker`; all access logged |
| PR-04 | Donor PII exposed via supporter lookup | Medium | Medium | Lookup requires exact match on 3 fields; rate-limited to 30 req/min |
| PR-05 | Resident data leaked via ML prediction API | Low | High | ML payloads contain only numeric features — no names, case codes, or narrative text |
| PR-06 | AI assistant (Vanessa) generates content exposing resident details | Low | High | System prompt explicitly prohibits content identifying individual survivors |
| PR-07 | Data retained indefinitely with no deletion policy | High | Medium | See Section 5 — data retention policy defined |
| PR-08 | Case notes transmitted insecurely | Low | Critical | All traffic uses HTTPS/TLS; HSTS enforced |

---

## 5. Data Retention & Deletion Policy

| Data Category | Retention Period | Deletion Trigger |
|---------------|-----------------|-----------------|
| Active resident records | Indefinite while case is open | Manual archive by Admin after case closure |
| Closed resident records | 7 years after closure | Manual deletion by Admin (legal hold period) |
| Donor records | Indefinite (donation history required for nonprofit reporting) | Donor requests deletion via Lighthouse Sanctuary |
| User accounts (staff) | Duration of employment | HR triggers account deletion after offboarding |
| User accounts (donors) | Until deletion requested | Self-service (not yet implemented — see PR-07) |
| Server logs | 30 days (Azure default) | Automatic rotation |
| JWT revocation entries | Until token expiry | Automatic (memory cache TTL) |

**Gap — PR-07:** No self-service donor account deletion is currently implemented. This should
be added to close the right-to-erasure gap under RA 10173 §16(d).

---

## 6. Technical Controls Summary

| Control | Mechanism | Addresses |
|---------|-----------|----------|
| Encryption in transit | TLS 1.2+ (Azure + Vercel), HSTS | PR-02, PR-08 |
| Encryption at rest | Supabase default AES-256 | PR-02 |
| Access control | JWT + Role-based authorization | PR-01, PR-03 |
| Resident-level filtering | `AssignedSocialWorker` filter | PR-03 |
| Input sanitization | `InputSanitizer` (HTML, entities, protocols) | General XSS |
| SQL injection prevention | Parameterized queries + EF Core | General injection |
| Rate limiting | `FixedWindowLimiter` on auth + public endpoints | PR-04 |
| No PII in ML payloads | Numeric feature vectors only | PR-05 |
| AI privacy guardrails | System prompt prohibition | PR-06 |
| Credential management | Environment variables; gitignored dev config | PR-02 |
| Audit logging | Structured logs on all auth events | PR-01, PR-03 |
| Breach response | `INCIDENT_RESPONSE.md` with NPC notification steps | All |

---

## 7. Data Subject Rights (RA 10173 §16)

| Right | Applicability | Current Support |
|-------|--------------|----------------|
| Right to be informed | Donors, staff | Privacy notice needed on registration page |
| Right of access | Donors, staff | Donors can view their own data via authenticated API |
| Right to rectification | Donors, staff | `PATCH /api/supporters/{id}` (authenticated) |
| Right to erasure | Donors | **Not implemented** — see PR-07 gap above |
| Right to data portability | Donors | Not implemented |
| Right to object | Donors | Not implemented |

**Note:** Resident data rights are exercised through Lighthouse Sanctuary's case management
process, not directly through the platform, as residents are minors in legal care.

---

## 8. NPC Accountability Requirements

Per RA 10173 §21 and NPC Circular 16-01:

- [x] PIA conducted prior to deployment
- [x] Data Protection Officer (DPO) role assigned to Development Lead during academic project
- [x] Breach notification procedure documented (`INCIDENT_RESPONSE.md` §4)
- [x] Technical safeguards implemented (see Section 6)
- [ ] Privacy notice displayed to donors on registration *(gap — to be added)*
- [ ] Data Processing Agreement with Supabase/AWS reviewed *(gap — to be reviewed)*
