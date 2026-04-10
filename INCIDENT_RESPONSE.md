# Incident Response Plan — Cove / Lighthouse Sanctuary Platform

**Classification:** Internal — Restricted  
**Date:** 2026-04-09  
**Owner:** Development Team Lead  
**Review cycle:** Every 6 months or after any incident

---

## 1. Purpose & Scope

This plan defines how the team responds to security incidents affecting the Cove platform,
including the backend API (Azure App Service), frontend (Vercel), and database (Supabase/PostgreSQL).

**Special obligation:** This system stores case records for child survivors of abuse and
trafficking. Any breach involving resident data triggers mandatory reporting obligations
to Lighthouse Sanctuary's legal counsel and may require notification to Philippine data
protection authorities under the Data Privacy Act of 2012 (Republic Act 10173).

---

## 2. Incident Classification

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|---------|
| **P1 — Critical** | Active breach; data exfiltration in progress or confirmed | Immediate (< 1 hour) | DB credentials used externally; resident data exfiltrated |
| **P2 — High** | Confirmed vulnerability actively exploited | < 4 hours | JWT forged; admin account compromised |
| **P3 — Medium** | Vulnerability confirmed but not yet exploited | < 24 hours | Hardcoded secret found in code; dependency CVE |
| **P4 — Low** | Suspected anomaly; no confirmed impact | < 72 hours | Unusual login pattern; elevated 429 rate |

---

## 3. Response Phases

### Phase 1 — Detect

**Signals to monitor:**

| Signal | Source | Indicator |
|--------|--------|-----------|
| Repeated 401/403 errors | Azure App Service logs | Credential stuffing attempt |
| Mass 429 responses from a single IP | Rate limiter logs | DoS attempt |
| Login from unexpected geography | Azure logs | Account compromise |
| `WARNING Failed login` spikes | Application logs | Brute-force attack |
| Unexpected DB connections | Supabase dashboard | Credential leak in use |
| JWT for revoked `jti` accepted | Application logs | Blacklist failure |

**Log locations:**
- Backend logs: Azure Portal → IntexBackend → Log stream
- Frontend logs: Vercel Dashboard → Deployments → Runtime Logs
- Database: Supabase Dashboard → Database → Logs

---

### Phase 2 — Contain

**Immediate containment actions by incident type:**

#### Compromised database credentials
1. Rotate the Supabase database password immediately
2. Update `ConnectionStrings__DefaultConnection` in Azure App Service environment variables
3. Restart the Azure App Service to pick up the new connection string
4. Review Supabase audit logs for unauthorized queries in the past 72 hours

#### Compromised JWT signing key
1. Generate a new 64-byte key: `openssl rand -base64 64`
2. Update `Jwt__Key` in Azure App Service environment variables
3. Restart the app service — this instantly invalidates all active sessions
4. All users will need to log in again (acceptable trade-off)

#### Compromised admin account
1. Use the DB directly to disable the account: `UPDATE "AspNetUsers" SET "LockoutEnabled" = true, "LockoutEnd" = '9999-01-01' WHERE "UserName" = 'admin'`
2. Change admin password via a direct DB update with a new Identity password hash
3. Review audit logs for all actions performed under that account

#### Active SQL injection / XSS attempt
1. Review application logs to identify the payload and endpoint
2. Add IP block at the Azure App Service or Vercel level if source is identified
3. Assess whether any data was read or modified

---

### Phase 3 — Investigate

**Preserve evidence before any changes:**
```bash
# Export relevant Azure logs before rotating credentials
az webapp log download --name IntexBackend --resource-group <rg> --log-file incident-$(date +%Y%m%d).zip
```

**Key questions:**
- What was accessed? (residents, donors, donations, all?)
- When did unauthorized access begin? (check earliest anomalous log entry)
- How was access obtained? (credential, JWT forgery, injection, insider?)
- Was data exfiltrated or only read?
- Which user accounts were involved?

**Document findings in:** `incidents/YYYY-MM-DD-<short-description>.md`

---

### Phase 4 — Notify

| Breach Type | Who to Notify | When | How |
|-------------|--------------|------|-----|
| Resident data (any) | Lighthouse Sanctuary legal counsel | Within 24 hours of confirmation | Direct call + email |
| Resident data (confirmed exfiltration) | Philippine NPC (National Privacy Commission) | Within 72 hours | NPC Breach Notification Form |
| Donor PII | Affected donors | Within 72 hours | Email from official Lighthouse Sanctuary address |
| Admin credentials | All admin users | Immediately | Direct contact |
| Infrastructure only (no data breach) | Internal team only | During investigation | Slack/email |

**Philippine NPC breach notification:** https://www.privacy.gov.ph/

---

### Phase 5 — Recover

**Recovery checklist:**
```
[ ] Vulnerable credential/key rotated
[ ] Azure App Service environment variables updated
[ ] App Service restarted and healthy
[ ] Supabase connection verified working
[ ] Audit logs reviewed for full scope of access
[ ] All affected user sessions invalidated (restart = new JWT key)
[ ] Monitoring alerts confirmed active
[ ] Dependency vulnerability patched (if supply chain incident)
[ ] New deployment pushed if code fix was required
```

---

### Phase 6 — Post-Incident Review

**Within 1 week of resolution:**

1. Write an incident report in `incidents/YYYY-MM-DD-<description>.md` covering:
   - Timeline
   - Root cause
   - Impact (records affected, duration)
   - Containment actions taken
   - What detection failed / what caught it
   - Prevention: what code/process change prevents recurrence

2. Update `THREAT_MODEL.md` if a new attack vector was discovered
3. Add a regression test to `SECURITY_TEST_PLAN.md` if applicable
4. Update `SECURITY_REQUIREMENTS.md` if a requirement was missing
5. Brief the full team on findings

---

## 4. Key Contacts & Resources

| Role | Responsibility |
|------|---------------|
| Development Lead | Incident coordinator; owns communication |
| Any team member | Can declare a P1/P2; must escalate to Dev Lead immediately |

**Emergency access:**
- Azure Portal: portal.azure.com → IntexBackend → Environment variables
- Supabase: supabase.com → Project → Database → Settings → Database password
- Vercel: vercel.com → intex-ochre → Settings → Environment Variables
- GitHub Secrets: github.com → repo → Settings → Secrets and variables

---

## 5. Runbook — Rotating All Credentials (Full Reset)

Use this if the scope of compromise is unknown:

```bash
# 1. Generate new JWT key
openssl rand -base64 64

# 2. Update Azure App Service environment variables:
#    Jwt__Key                          → new key from above
#    ConnectionStrings__DefaultConnection → new Supabase connection string
#    SeedUsers__Admin__Password        → new admin password
#    Anthropic__ApiKey                 → rotate in Anthropic console

# 3. Restart app service
az webapp restart --name IntexBackend --resource-group <resource-group>

# 4. Verify health
curl https://intexbackend-dragb9ahdsfvejfe.centralus-01.azurewebsites.net/api/auth/me
# Expect: 401 (service is up, auth is working)
```
