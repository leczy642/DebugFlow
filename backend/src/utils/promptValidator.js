// promptValidator.js
// ---------------------------------------------
// CLEAN, SAFE, CONSISTENT VALIDATOR PIPELINE
// ---------------------------------------------
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// Allowed debugging-related keywords

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let TECH_KEYWORDS = [];

// ---------------------------------------------
// 1️⃣ loadKeywords()
//
// loads the keywords from a file - keyword.txt, which is neater, faster
// and avoids the overhead of generating similarity scores using embeddings
// ---------------------------------------------
function loadKeywords() {
  try {
    const filePath = path.join(__dirname, "keywords.txt");
    const content = fs.readFileSync(filePath, "utf8");

    //convert the keywords to an array
    TECH_KEYWORDS = content
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0 && !line.startsWith("#")); // support comments

  } catch (err) {
    console.error("Failed to load keywords file:", err.message);
    TECH_KEYWORDS = []; // fail-safe
  }
}

// Load immediately at module load
loadKeywords()
// ---------------------------------------------
// 1️⃣ sanitizePromptInput()
//
// Removes dangerous characters, compresses whitespace,
// trims input, and makes the string safe to inject.
// ---------------------------------------------
export function sanitizePromptInput(input) {
  if (!input) return "";

  return input
    .replace(/[<>{}[\]]/g, "")           // Strip angle brackets & braces
    .replace(/[`$]/g, "")                // Remove template literal injection chars
    .replace(/\s+/g, " ")                // Normalize whitespace
    .trim();
}


// ---------------------------------------------
// 2️⃣ validatePromptScope()
//
// Ensures prompt is related to debugging topics.
// Does NOT throw. Instead returns { ok: false, error }
// ---------------------------------------------
export function validatePromptScope(rawQuery) {
  const q = rawQuery.toLowerCase();

  const matches = TECH_KEYWORDS.some((word) => q.includes(word));

  if (!matches) {
    return {
      ok: false,
      error: "Your prompt is out of scope. Include more context in your prompt. Allowed topics include: error messages, stacktraces, logs, exceptions, and bugs."
    };
  }

  return { ok: true };
}


// ---------------------------------------------
// 3️⃣ normalizeUserQuery()
// - Main orchestrator
// Full pipeline:
//  - sanitizes
//  - validates scope
//  - returns consistent object
// ---------------------------------------------
export function normalizeUserQuery(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return {
      ok: false,
      error: "Input must be a string."
    };
  }

  // 1. sanitize
  const sanitized = sanitizePromptInput(rawInput);

  // 2. scope validation
  const scopeCheck = validatePromptScope(sanitized);
  if (!scopeCheck.ok) {
    return scopeCheck; // { ok:false, error:"..." }
  }

  // 3. success
  return {
    ok: true,
    query: sanitized
  };
}


// ---------------------------------------------
// 4️⃣ A helper for callers who want exceptions
// (optional)
// ---------------------------------------------
export function assertValidQuery(rawInput) {
  const result = normalizeUserQuery(rawInput);

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.query;
}
