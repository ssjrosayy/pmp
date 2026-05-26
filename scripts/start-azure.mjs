import { spawn } from "node:child_process";

if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
  throw new Error("Set DATABASE_URL to the Azure Cosmos DB for MongoDB connection string before startup.");
}

await new Promise((resolve, reject) => {
  const child = spawn("npx", ["next", "start"], { env: process.env, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Next.js exited with code ${code}.`));
  });
});
