import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

if (!process.env.DATABASE_URL?.startsWith("mongodb")) {
  throw new Error("Set DATABASE_URL to the Azure Cosmos DB for MongoDB connection string before startup.");
}

const port = process.env.PORT || "8080";
const nextBinCandidates = [
  path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
  path.join("/node_modules", "next", "dist", "bin", "next"),
];

async function existingNextBin() {
  for (const candidate of nextBinCandidates) {
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch {
      // Try the next Azure/local node_modules location.
    }
  }
  return null;
}

async function nextVersion() {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  return packageJson.dependencies?.next ?? "latest";
}

const nextBin = await existingNextBin();
const command = nextBin ? process.execPath : "npx";
const args = nextBin
  ? [nextBin, "start", "-p", port]
  : ["--yes", `next@${await nextVersion()}`, "start", "-p", port];

if (!nextBin) {
  console.warn("Next.js binary was not found in Azure node_modules; using npx fallback.");
}

await new Promise((resolve, reject) => {
  const child = spawn(command, args, { env: process.env, stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Next.js exited with code ${code}.`));
  });
});
