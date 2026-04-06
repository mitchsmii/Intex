# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ASP.NET Core Web API (.NET 10.0) serving as the backend for the Intex project. Uses Entity Framework Core with PostgreSQL (Supabase-hosted). Part of a monorepo — frontend is a React+Vite app at `frontend/intex/`.

## Build & Run Commands

```bash
# From this directory (backend/WebApplication1/WebApplication1)
dotnet build
dotnet run                    # Runs on http://localhost:5280, https://localhost:7054
dotnet publish -c Release     # Production build
```

No test project exists yet. To add one: `dotnet new xunit -n WebApplication1.Tests` in the solution directory, then `dotnet test`.

## Architecture

- **Program.cs** — Entry point. Configures services (EF Core, CORS, OpenAPI, controllers) and middleware pipeline.
- **Controllers/** — API controllers. Route prefix: `api/[controller]` (e.g., `api/users`).
- **Data/AppDbContext.cs** — EF Core DbContext. Registered as a service in Program.cs using Npgsql.
- **Data/User.cs** — Entity model mapped to `"users"` table. Column names use snake_case (`first_name`, `last_name`).

## Database

- **Provider:** PostgreSQL via `Npgsql.EntityFrameworkCore.PostgreSQL`
- **Host:** Supabase (connection string in `appsettings.json` under `ConnectionStrings:DefaultConnection`)
- **No migrations tracked yet** — code-first approach but no `Migrations/` folder exists.
- EF Core commands: `dotnet ef migrations add <Name>`, `dotnet ef database update`

## CORS Configuration

Allowed origins configured in Program.cs ("AllowFrontend" policy):
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000`
- `https://intex-ochre.vercel.app` (production frontend)

All methods and headers are allowed.

## Deployment

- **CI/CD:** GitHub Actions (`.github/workflows/main_intexbackend.yml`) triggers on push to `main`
- **Host:** Azure App Service (`IntexBackend`, Central US)
- **Frontend:** Deployed separately to Vercel

## Key Conventions

- Entity column names use snake_case to match PostgreSQL conventions
- `InvariantGlobalization` is enabled in the csproj
- Swagger UI auto-launches in Development environment at `/swagger`
