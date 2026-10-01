import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root (apps/web/src/lib → ../../../..). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export const POLICIES_DIR = path.join(REPO_ROOT, "content/policies");
