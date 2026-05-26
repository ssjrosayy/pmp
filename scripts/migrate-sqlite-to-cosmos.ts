import "dotenv/config";
import Database from "better-sqlite3";
import { MongoClient } from "mongodb";

const sourcePath = process.env.SQLITE_SOURCE_PATH ?? "dev.db";
const connectionString = process.env.DATABASE_URL;

if (!connectionString?.startsWith("mongodb")) {
  throw new Error("Set DATABASE_URL to an Azure Cosmos DB for MongoDB connection string.");
}

type Column = {
  name: string;
  type: string;
};

type MigratedDocument = Record<string, unknown> & {
  _id: string;
};

function documentFromRow(table: string, row: Record<string, unknown>, columns: Column[]) {
  const document: Record<string, unknown> = {};

  for (const column of columns) {
    const value = row[column.name];
    const type = column.type.toUpperCase();
    if (column.name === "id") {
      document._id = String(value);
    } else if (value === null || value === undefined) {
      document[column.name] = value;
    } else if (type.includes("DATETIME")) {
      document[column.name] = new Date(String(value));
    } else if (type.includes("BOOLEAN")) {
      document[column.name] = Boolean(value);
    } else if (type.includes("JSON")) {
      document[column.name] = typeof value === "string" ? JSON.parse(value) : value;
    } else {
      document[column.name] = value;
    }
  }

  if (!document._id && table === "RolePermission") {
    document._id = `permission-${String(document.roleId)}-${String(document.permissionId)}`;
  }
  if (!document._id) {
    throw new Error(`Unable to migrate ${table}: record is missing an id.`);
  }

  return document as MigratedDocument;
}

async function main(targetConnectionString: string) {
  const source = new Database(sourcePath, { readonly: true });
  const client = new MongoClient(targetConnectionString);

  try {
    await client.connect();
    const target = client.db();
    const tables = source
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name")
      .all() as { name: string }[];

    for (const { name } of tables) {
      const columns = source.prepare(`PRAGMA table_info("${name}")`).all() as Column[];
      const rows = source.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
      if (rows.length === 0) {
        console.log(`${name}: no records to import.`);
        continue;
      }

      const operations = rows.map((row) => {
        const replacement = documentFromRow(name, row, columns);
        return {
          replaceOne: {
            filter: { _id: replacement._id },
            replacement,
            upsert: true,
          },
        };
      });
      await target.collection<MigratedDocument>(name).bulkWrite(operations, { ordered: true });
      console.log(`${name}: imported ${rows.length} record(s).`);
    }
  } finally {
    source.close();
    await client.close();
  }
}

main(connectionString).catch((error) => {
  console.error("Unable to migrate SQLite records to Cosmos DB.", error);
  process.exitCode = 1;
});
