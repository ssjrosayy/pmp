import { EJSON } from "bson";
import { MongoClient } from "mongodb";
import { NextResponse } from "next/server";
import { ActivityAction } from "@prisma/client";
import { readSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { isSuperAdmin } from "@/lib/rbac";

function cosmosConnectionString() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.startsWith("mongodb")) {
    throw new Error("Database export is available only for MongoDB-compatible storage.");
  }

  return connectionString;
}

export async function GET() {
  const user = await readSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const date = new Date().toISOString().slice(0, 10);
  const client = new MongoClient(cosmosConnectionString());

  try {
    await writeAudit({
      actorId: user.id,
      action: ActivityAction.SHARE,
      entityType: "Database",
      summary: `${user.name} exported the Cosmos DB database.`,
    });

    await client.connect();
    const database = client.db();
    const collectionNames = (await database.listCollections({}, { nameOnly: true }).toArray())
      .map(({ name }) => name)
      .filter((name) => !name.startsWith("system."))
      .sort();
    const collections = Object.fromEntries(
      await Promise.all(
        collectionNames.map(async (name) => [name, await database.collection(name).find({}).toArray()]),
      ),
    );
    const snapshot = EJSON.stringify(
      { exportedAt: new Date(), database: database.databaseName, collections },
      undefined,
      2,
      { relaxed: false },
    );

    return new NextResponse(snapshot, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="axis-database-${date}.json"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Unable to export database.", error);
    return NextResponse.json({ error: "Unable to export database." }, { status: 500 });
  } finally {
    await client.close().catch(() => undefined);
  }
}
