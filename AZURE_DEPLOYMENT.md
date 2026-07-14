# Azure Deployment

This repository is ready to deploy from your own GitHub account to your own Azure App Service.

## What Was Removed

The old GitHub Actions workflow was removed because it targeted a previous Azure Web App and referenced Azure secrets from another account. Do not reuse that workflow for a new Azure account.

## Recommended Azure Setup

Use Azure App Service for this app. It is a Next.js application with API routes, so Azure Static Web Apps is not the best fit.

1. Create a Linux Azure App Service.
2. Choose Node.js 22 as the runtime stack.
3. In Deployment Center, connect your own GitHub repository and branch.
4. In App Service configuration, add these application settings:

```text
DATABASE_URL=<your MongoDB connection string>
JWT_SECRET=<a long random secret, at least 24 characters>
SCM_DO_BUILD_DURING_DEPLOYMENT=true
WEBSITE_NODE_DEFAULT_VERSION=~22
```

5. Set the App Service startup command to:

```text
npm start
```

The `npm start` script runs `scripts/start-azure.mjs`, which starts Next.js on Azure's assigned `PORT`.

## Database

The app expects a MongoDB-compatible database URL. You can use either:

- MongoDB Atlas free/shared cluster
- Azure Cosmos DB for MongoDB, preferably a low-cost RU/serverless/free-tier account

Avoid Azure's expensive DocumentDB/vCore cluster page if it shows hundreds of dollars per month.

For a new empty database, run these once after setting `DATABASE_URL`:

```bash
npm run db:indexes
npm run db:seed
```

Do not commit real `.env` files or database connection strings. Keep secrets only in Azure App Service configuration.
