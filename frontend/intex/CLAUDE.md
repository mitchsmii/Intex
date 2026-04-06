# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React 19 + TypeScript frontend for the Intex project (a donor/social worker/admin platform called "Cove"). Built with Vite 8. Part of a monorepo — backend is an ASP.NET Core API at `backend/WebApplication1/WebApplication1/`.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Type-check (tsc -b) then Vite build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Architecture

- **Pages** (`src/pages/`) — Route-level components organized by role: `public/`, `donor/`, `socialworker/`, `admin/`
- **Components** (`src/components/`) — Reusable UI organized by domain: `common/`, `public/`, `donor/`, `socialworker/`, `admin/`
- **Services** (`src/services/`) — API call modules. `apiService.ts` is the base; others are domain-specific.
- **Context** (`src/context/`) — React Context providers (AuthContext, ThemeContext)
- **Hooks** (`src/hooks/`) — Custom hooks wrapping context and API logic
- **Types** (`src/types/`) — Shared TypeScript interfaces
- **Utils** (`src/utils/`) — Pure utility functions

## API Integration

- Backend URL configured via `VITE_API_URL` env var
- Falls back to: `https://intexbackend-dragb9ahdsfvejfe.centralus-01.azurewebsites.net`
- Backend runs locally on `http://localhost:5280`

## Styling

Plain CSS with CSS custom properties — no Tailwind, no CSS modules, no styled-components.

**Brand palette ("Cove")** defined in `src/styles/variables.css`:
- `--cove-deep: #2c4a52` (dark teal)
- `--cove-tidal: #5e9ea0` (medium teal — primary color)
- `--cove-seaglass: #a8d5ba` (soft green)
- `--cove-seafoam: #d4ebd0` (light green)
- `--cove-sand: #f0e6d3` (sandy cream)

**Semantic tokens** map to the palette: `--color-primary`, `--color-primary-dark`, `--color-primary-light`, plus status colors (`--color-success`, `--color-warning`, `--color-error`).

**Spacing scale:** `--space-xs` (4px) through `--space-2xl` (64px).

**Border radius:** `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (16px), `--radius-full`.

**Shadows:** `--shadow-sm`, `--shadow-md`, `--shadow-lg` — all use `rgba(44, 74, 82, ...)` base.

Always use these CSS variables instead of hardcoded values. Import `variables.css` in any new CSS files that need design tokens.

## Auth & Roles

Three user roles with separate layouts and page sets:
- **Donor** — donation management
- **Social Worker** — case management
- **Admin** — user/role management, reports

Public pages (home, about, login, register) use `PublicLayout`. Each role has its own layout component and protected routes via `ProtectedRoute`.

## TypeScript

- Strict mode enabled (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- Target: ES2023
- Module resolution: `bundler`
