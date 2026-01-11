import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";

// Create postgres client
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create postgres connection
const client = postgres(connectionString);

// Create drizzle database instance with schema
export const db = drizzle(client, { schema });

// Export types for convenience
export type Database = typeof db;
