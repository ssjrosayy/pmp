import "dotenv/config";
import { MongoClient } from "mongodb";

const connectionString = process.env.DATABASE_URL;

if (!connectionString?.startsWith("mongodb")) {
  throw new Error("Set DATABASE_URL to the Azure Cosmos DB for MongoDB connection string.");
}

async function main(targetConnectionString: string) {
  const client = new MongoClient(targetConnectionString);
  try {
    await client.connect();
    const database = client.db();
    await Promise.all([
      database.collection("Role").createIndex({ name: 1 }, { unique: true }),
      database.collection("Permission").createIndex({ resource: 1, action: 1 }, { unique: true }),
      database.collection("RolePermission").createIndex({ roleId: 1, permissionId: 1 }, { unique: true }),
      database.collection("User").createIndex({ email: 1 }, { unique: true }),
      database.collection("User").createIndex({ roleId: 1 }),
      database.collection("User").createIndex({ departmentId: 1 }),
      database.collection("Department").createIndex({ name: 1 }, { unique: true }),
      database.collection("Project").createIndex({ ownerId: 1 }),
      database.collection("Project").createIndex({ departmentId: 1 }),
      database.collection("Project").createIndex({ status: 1 }),
      database.collection("ProjectMember").createIndex({ projectId: 1, userId: 1 }, { unique: true }),
      database.collection("Task").createIndex({ projectId: 1 }),
      database.collection("Task").createIndex({ assigneeId: 1 }),
      database.collection("Task").createIndex({ departmentId: 1 }),
      database.collection("Task").createIndex({ status: 1 }),
      database.collection("Document").createIndex({ category: 1 }),
      database.collection("Document").createIndex({ status: 1 }),
      database.collection("HRProfile").createIndex({ userId: 1 }, { unique: true }),
      database.collection("HRProfile").createIndex({ employeeCode: 1 }, { unique: true, sparse: true }),
      database.collection("Notification").createIndex({ userId: 1, readAt: 1 }),
      database.collection("AuditLog").createIndex({ actorId: 1 }),
      database.collection("AuditLog").createIndex({ entityType: 1, entityId: 1 }),
    ]);
    console.log(`Cosmos DB indexes are ready in ${database.databaseName}.`);
  } finally {
    await client.close();
  }
}

main(connectionString).catch((error) => {
  console.error("Unable to configure Cosmos DB indexes.", error);
  process.exitCode = 1;
});
