PROJECT: Backend API for the personal portfolio and blogging platform of Hammad Sadi (MERN stack developer and AI engineer). It serves dynamic portfolio content (profile, skills, projects, experience, education, testimonials, site settings), a multi-author markdown blog with comments, likes, follows and feeds, authentication (email/password with OTP verification and OAuth 2.0), contact messages, analytics, and admin management.

STACK: Node.js, TypeScript (strict), Express, MongoDB with Mongoose, Zod. Deployed on Vercel as a serverless project. The monorepo root uses pnpm workspaces (/server and /client).

ENGINEERING RULES (strict):
1. Reusable, scalable, fully typed code (no `any`), DRY and SOLID. No hacks, no dead code, no unused dependencies.
2. Module pattern: src/modules/<feature>/{<feature>.route.ts, <feature>.controller.ts, <feature>.service.ts, <feature>.model.ts, <feature>.validation.ts, <feature>.types.ts}. Controllers are thin, business logic lives in services, validation uses Zod middleware.
3. Centralized error handling (AppError class, global error middleware, async handler wrapper) and a consistent API response shape { success, message, data, meta }.
4. Environment variables validated with Zod at startup.
5. Security: helmet, rate limiting, input sanitization, secure httpOnly cookies, hashed tokens and OTPs, no secrets in code, authorization on every non-public route, strict Zod schemas that reject unknown keys on writes.
6. Database: an index for every query pattern, atomic counter updates, cursor pagination for feeds and large lists, no N+1 queries.
7. Serverless: cached DB connection, always await async work before responding, no in-memory state that must survive between requests.
8. Brand: the owner and site brand name is "Hammad Sadi". Use it in email templates, seed data, API docs titles, and READMEs.
9. After finishing any task, run type-check, lint, and tests, fix all errors, and summarize what changed.

Keep the file concise and actionable.
