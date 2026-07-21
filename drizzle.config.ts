import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.js", // Points to where your database tables are defined
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Reads your Supabase connection string
  },
});
