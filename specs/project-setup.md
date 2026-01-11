# Project Setup

Initial project configuration, dependencies, and tooling setup.

## Overview

Before implementing features, the project needs proper tooling, testing infrastructure, and dependencies installed.

## Dependencies to Install

### Production Dependencies

```bash
npm install drizzle-orm postgres
npm install @tanstack/react-query
npm install zod
npm install ai @ai-sdk/groq
```

### Development Dependencies

```bash
npm install -D drizzle-kit
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom
npm install -D playwright @playwright/test
npm install -D msw
npm install -D @types/node
```

### shadcn/ui Setup

```bash
npx shadcn@latest init
npx shadcn@latest add button card tabs input textarea badge dialog dropdown-menu toast skeleton
```

## Package.json Scripts

Add these scripts to `webapp/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx drizzle/seed.ts"
  }
}
```

## TypeScript Configuration

Ensure `tsconfig.json` has strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Drizzle Configuration

Create `webapp/drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Vitest Configuration

Create `webapp/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

Create `webapp/vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

## Playwright Configuration

Create `webapp/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## MSW Setup for API Mocking

Create `webapp/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Reddit API mocks will go here
];
```

Create `webapp/mocks/server.ts`:

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

## Directory Structure

After setup, the webapp structure should be:

```
webapp/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── layout.tsx
│   └── page.tsx
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Shared utilities
│   ├── db.ts             # Drizzle client
│   ├── reddit.ts         # Reddit API client
│   └── utils.ts          # General utilities
├── drizzle/
│   ├── schema.ts         # Database schema
│   ├── migrations/       # Generated migrations
│   └── seed.ts           # Seed script
├── mocks/                 # MSW mocks
├── e2e/                   # Playwright tests
├── __tests__/             # Unit tests (or colocated)
├── drizzle.config.ts
├── vitest.config.ts
├── vitest.setup.ts
└── playwright.config.ts
```

## Acceptance Criteria

1. **Dependencies installed** - All listed packages are in package.json and installed
2. **Scripts work** - All package.json scripts execute without error
3. **TypeScript strict** - `npm run typecheck` passes with strict mode
4. **Vitest runs** - `npm run test` executes (even if no tests yet)
5. **Playwright runs** - `npm run test:e2e` executes (even if no tests yet)
6. **Drizzle configured** - `npm run db:generate` works with schema
7. **shadcn/ui installed** - Components are available in components/ui
8. **MSW configured** - Mock server can be started in tests
9. **Path aliases work** - `@/` imports resolve correctly
