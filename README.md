# Axis Ops

Full-stack internal project management and company operations platform for Axis.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- JWT session cookie authentication
- Centralized role-based access control

## First Run

1. Install dependencies:

```bash
npm install
```

2. Create environment variables:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL` to PostgreSQL on Supabase, Railway, Render, Neon, or a local database.

For local development without Docker/Postgres installed, start Prisma's bundled Postgres server:

```bash
npm run db:dev
```

If Prisma prints a generated local URL, place that value in `.env` as `DATABASE_URL`.

4. Generate Prisma client and sync the database:

```bash
npm run prisma:generate
npm run prisma:migrate
```

When using Prisma's local dev server, `npx prisma db push` is also supported for first-time local setup.

5. Seed Axis data:

```bash
npm run db:seed
```

6. Start development:

```bash
npm run dev
```

Default seeded login:

- Email: `admin@axis.local`
- Password: `Axis@12345`

## Deployment

- Vercel: deploy the Next.js app and set `DATABASE_URL` and `JWT_SECRET`.
- Railway/Render/Supabase/Postgres: provision PostgreSQL and paste its connection string into `DATABASE_URL`.
- Run migrations during release with `npx prisma migrate deploy`.
- Run `npm run db:seed` only for first-time setup or demo environments.

## Access Model

The platform includes roles for Super Admin/CEO, Admin/Ops, Department Head, Project Manager, Employee, Intern, and Client/Guest. API routes enforce read/write access by module, project membership, department, finance access, and sensitive document flags.
