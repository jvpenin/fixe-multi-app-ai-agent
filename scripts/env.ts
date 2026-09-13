import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Next.js auto-loads .env.local; a plain `tsx` script does not. Import this
 * first (`import "./env"`) in any scripts/*.ts file that reads process.env.
 */
const envLocal = resolve(process.cwd(), ".env.local");
const envDefault = resolve(process.cwd(), ".env");
config({ path: existsSync(envLocal) ? envLocal : envDefault });
