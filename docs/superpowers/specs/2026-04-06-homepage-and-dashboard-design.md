# Cove — Home Page & Social Worker Dashboard

**Date:** 2026-04-06

## Overview

Build two pages for Cove, a platform for social workers and admins to track and support girls who have experienced sexual assault. The design should feel safe, warm, professional, and trustworthy.

## Page 1: Home Page (Public Landing)

**Style:** Minimal & clean — white background, soft green accents, role-based sections.

**Layout (top to bottom):**

1. **Nav bar** — white background, border-bottom
   - Left: Cove logo (wave emoji + "Cove" text in `--cove-tidal`)
   - Right: "Mission", "About", "Contact" text links + "Sign In" button (`--cove-tidal` background, white text, rounded)

2. **Hero section** — gradient background (`--cove-seafoam` to `--cove-seaglass`), centered text, generous padding
   - Heading: "Compassionate Care, Secure Tools"
   - Subtitle: "A platform built with trauma-informed design for those who support survivors"

3. **Role cards section** — 2-column grid on light background
   - "For Social Workers" card: brief description of case management, notes, resources
   - "For Administrators" card: brief description of oversight, user management, reports
   - Cards: white background, subtle shadow, rounded corners

4. **Footer** — simple, `--cove-deep` background, white text, copyright + links

**Route:** `/`

## Page 2: Social Worker Dashboard

**Style:** Full dark sidebar (always visible) + light content area.

**Sidebar (fixed left, 240px wide):**
- Background: `--cove-deep` (#2c4a52), full viewport height
- Top: Cove logo (wave emoji + "Cove" in white/seaglass)
- Nav items (vertical, icon + label):
  - Cases (clipboard icon)
  - Notes (pencil icon)
  - Resources (book icon)
  - Messages (chat icon)
  - Reports (chart icon)
- Active item: `--cove-seaglass` background at 20% opacity, text in `--cove-seaglass`
- Inactive items: white text at 70% opacity
- Bottom: user name, muted style, top border separator

**Main content area (right of sidebar):**
- Background: `#f8f9fa`
- Page header: "My Cases" with optional action button area
- Placeholder case cards:
  - White background, subtle shadow, rounded
  - Case number (bold), status badge, "last updated" text
  - 3 sample cards as placeholder content

**Route:** `/dashboard`

## Technical Approach

- Install `react-router-dom` for client-side routing
- Update `App.tsx` to define routes: `/` → HomePage, `/dashboard` → SocialWorkerDashboard
- Create CSS files alongside components using plain CSS with existing design tokens
- Reuse existing component stubs where they exist (`HomePage`, `Sidebar`, `SocialWorkerLayout`, etc.)
- No auth wiring yet — just the two pages accessible by URL

## Files to Create/Modify

1. **Install:** `react-router-dom`
2. **Modify:** `src/App.tsx` — replace current content with router setup
3. **Modify:** `src/pages/public/HomePage.tsx` — full landing page
4. **Create:** `src/pages/public/HomePage.css` — home page styles
5. **Modify:** `src/components/common/Sidebar.tsx` — dark teal sidebar nav
6. **Create:** `src/components/common/Sidebar.css` — sidebar styles
7. **Modify:** `src/components/common/SocialWorkerLayout.tsx` — sidebar + content area wrapper
8. **Create:** `src/components/common/SocialWorkerLayout.css` — layout styles
9. **Modify:** `src/pages/socialworker/SocialWorkerHomePage.tsx` — dashboard with placeholder cases
10. **Create:** `src/pages/socialworker/SocialWorkerHomePage.css` — dashboard styles
