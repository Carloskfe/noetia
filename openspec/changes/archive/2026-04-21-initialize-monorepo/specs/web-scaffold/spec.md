## ADDED Requirements

### Requirement: Next.js application starts and is reachable
The `services/web` directory SHALL contain a runnable Next.js 14+ application using the App Router, TypeScript, and Tailwind CSS, with a root page (`/`) that renders without errors.

#### Scenario: Development server starts
- **WHEN** `pnpm dev` is run inside `services/web`
- **THEN** the Next.js dev server starts on port 3000 and the root page returns HTTP 200

#### Scenario: Production build succeeds
- **WHEN** `pnpm build` is run inside `services/web`
- **THEN** Next.js compiles all pages without TypeScript or build errors

### Requirement: Route group structure is scaffolded
The `services/web/app` directory SHALL contain empty route groups matching the planned navigation: `(reader)/`, `(library)/`, `(fragments)/`, `(social)/`, `(admin)/` — each with a minimal `page.tsx` returning a placeholder.

#### Scenario: Route groups resolve without 404
- **WHEN** the Next.js dev server is running and a request is made to `/library`
- **THEN** the server responds with HTTP 200 and renders the placeholder page

### Requirement: Tailwind CSS is configured
The `services/web` directory SHALL include a `tailwind.config.ts` with content paths covering `app/**/*.tsx` and `components/**/*.tsx`, and a global CSS file importing Tailwind base, components, and utilities.

#### Scenario: Tailwind classes apply correctly
- **WHEN** a component uses a Tailwind utility class (e.g., `bg-blue-500`)
- **THEN** the class is present in the compiled CSS output

### Requirement: Dockerfile builds a production image
The `services/web/Dockerfile` SHALL produce a runnable Next.js production image using a multi-stage build with the standalone output mode.

#### Scenario: Docker image starts the Next.js server
- **WHEN** `docker build -t noetia-web .` is run inside `services/web`
- **THEN** the image starts and serves the application on port 3000
