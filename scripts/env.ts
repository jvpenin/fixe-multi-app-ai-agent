import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Next.js auto-loads .env (and .env.local, if present); a plain `tsx` script
 * does not. Import this first (`import "./env"`) in any scripts/*.ts file
 * that reads process.env. This repo's local convention is a plain `.env`
 * (already gitignored) rather than `.env.local`, but both are supported.
 */
const envLocal = resolve(process.cwd(), ".env.local");
const envDefault = resolve(process.cwd(), ".env");
config({ path: existsSync(envLocal) ? envLocal : envDefault });
