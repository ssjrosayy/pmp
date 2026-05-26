# Axis Ops

Full-stack internal project management and company operations platform for Axis.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Azure Cosmos DB for MongoDB API
- Prisma ORM 6 MongoDB connector
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

3. Set an Azure Cosmos DB for MongoDB connection string with a database name:

```dotenv
DATABASE_URL="mongodb://<account>:<key>@<account>.mongo.cosmos.azure.com:10255/axis_ops?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@<account>@"
```

4. Generate the Prisma client and, for a new empty Cosmos database only, create its collections and indexes:

```bash
npm run prisma:generate
npm run prisma:push
```

5. For a new empty environment that needs the demonstration seed, run `npm run db:seed`. Then start development:

```bash
npm run dev
```

Default seeded super-admin logins:

- CEO: `ceo@axis-internal.com` / `Axis@12345`
- CTO: `cto@axis-internal.com` / `Axis@12345`

## Deployment

- All application modules use the configured Cosmos DB database as the shared persistent store.
- Prisma ORM 7 does not currently support MongoDB; this application intentionally uses Prisma ORM 6.19 for the Cosmos DB for MongoDB connector.
- Set `JWT_SECRET` to a secure value in every deployed environment.
- Store `DATABASE_URL` in App Service configuration or Key Vault references, not committed source files.
- Run `npm run db:seed` only for a new demo environment. The existing platform data has already been migrated into Cosmos DB.

### Azure App Service With Cosmos DB

For Azure App Service deployment:

- Use a Linux Node.js App Service and the startup command `npm run start:azure`.
- Set `DATABASE_URL` to the Cosmos DB for MongoDB connection string including `/axis_ops`, plus a secure `JWT_SECRET`, in App Service configuration.
- Provision collections and indexes once with `npm run prisma:push`, then use the startup command for normal application starts.
- Cosmos DB is shared storage, so App Service can scale without relying on a local database file.

Super admins can download a full Extended JSON export of all Cosmos DB collections from User Administration. Extended JSON preserves database value types such as dates.

## Access Model

The platform includes roles for Super Admin, Admin/Ops, Department Head, Project Manager, Employee, Intern, and Client/Guest. Only seeded CEO/CTO super admins can administer user accounts; API routes also enforce access by module, project membership, department, finance access, and sensitive document flags.

Super admins create users using an internal username; accounts receive the fixed `@axis-internal.com` domain. Signed-in users can change their own password after confirming their existing password.
