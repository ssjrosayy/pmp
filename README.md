# Axis Ops

Full-stack internal project management and company operations platform for Axis.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Azure Cosmos DB for MongoDB API
- Official MongoDB Node.js driver
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

4. For a new empty Cosmos database, create its indexes:

```bash
npm run db:indexes
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
- The server uses the official MongoDB Node.js driver against Cosmos DB for MongoDB.
- Set `JWT_SECRET` to a secure value in every deployed environment.
- Store `DATABASE_URL` in App Service configuration or Key Vault references, not committed source files.
- Run `npm run db:seed` only for a new demo environment. The existing platform data has already been migrated into Cosmos DB.
- See `AZURE_DEPLOYMENT.md` for the clean setup steps when deploying from a new GitHub/Azure account.

### Azure App Service With Cosmos DB

For Azure App Service deployment:

- Use a Linux Node.js App Service and the startup command `npm run start:azure` or `npm start`.
- Use Node.js 22, matching the `engines` field in `package.json`.
- Set `DATABASE_URL` to the Cosmos DB for MongoDB connection string including `/axis_ops`, plus a secure `JWT_SECRET`, in App Service configuration.
- When switching deployment sources, enable App Service build during deployment so Azure regenerates `oryx-manifest.toml` and `node_modules.tar.gz` from the current GitHub commit.
- Provision indexes once with `npm run db:indexes`, then use the startup command for normal application starts.
- Cosmos DB is shared storage, so App Service can scale without relying on a local database file.

Super admins can download a full Extended JSON export of all Cosmos DB collections from User Administration. Extended JSON preserves database value types such as dates.

## Access Model

The platform includes roles for Super Admin, Admin/Ops, Department Head, Project Manager, Employee, Intern, and Client/Guest. Only seeded CEO/CTO super admins can administer user accounts; API routes also enforce access by module, project membership, department, finance access, and sensitive document flags.

Super admins create users using an internal username; accounts receive the fixed `@axis-internal.com` domain. Signed-in users can change their own password after confirming their existing password.
