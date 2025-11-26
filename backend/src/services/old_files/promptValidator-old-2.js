// promptValidator.js
// ---------------------------------------------
// CLEAN, SAFE, CONSISTENT VALIDATOR PIPELINE
// ---------------------------------------------

// Allowed debugging-related keywords
const DEBUG_KEYWORDS = [
    "error",
    "exception",
    "stack",
    "stacktrace",
    "trace",
    "log",
    "bug",
    "debug",
    "crash",
    "fail",
    "undefined",
    "cannot",
    "not found"
  ];
  
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
  
    const matches = DEBUG_KEYWORDS.some((word) => q.includes(word));
  
    if (!matches) {
      return {
        ok: false,
        error: "Your prompt is out of scope. Allowed topics include: error messages, stacktraces, logs, exceptions, and bugs."
      };
    }
  
    return { ok: true };
  }
  
  
  // ---------------------------------------------
  // 3️⃣ normalizeUserQuery()
  //
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
  