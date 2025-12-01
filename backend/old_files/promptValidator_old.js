// promptValidator.js
//2 in 1 module 
//uses sanitizePromptInput to remove dangerous character from payload to avoid 
//jail breaking attempts
// uses validatePromptScope to ensure that the prompt entered is within scope
//However, we can still import sanitize.js and promptScopeValidator.js to access the functions 
//seperately
import he from "he"; // optional but recommended for HTML escaping

// Allowed prompt categories
const ALLOWED_KEYWORDS = [
  "error",
  "bug",
  "stack",
  "stacktrace",
  "debug",
  "issue",
  "crash",
  "exception",
  "fail",
  "trace",
  "log"
];

const MAX_LENGTH = 2000; // Hard safety limit


// -------------------------------------------------------------
// 1) Sanitization: remove dangerous characters and escape payloads
// -------------------------------------------------------------
export function sanitizePromptInput(input) {
  if (!input) return "";

  let cleaned = input;

  // Remove NULL bytes & control characters
  cleaned = cleaned.replace(/[\0\x00-\x1F\x7F]/g, "");

  // Remove escape sequences (\x1b, ANSI, unicode trick attacks)
  cleaned = cleaned.replace(/\u001b\[[0-9;]*m/g, "");

  // Replace dangerous prompt-control tokens
  cleaned = cleaned
    .replace(/(<\/?system>)/gi, "")
    .replace(/(<\/?assistant>)/gi, "")
    .replace(/(<\/?user>)/gi, "")
    .replace(/(<\/?developer>)/gi, "");

  // Remove "Ignore previous instructions" jailbreak attempts
  cleaned = cleaned.replace(/ignore (all|previous|above) instructions/gi, "");

  // HTML-escape to prevent XML or HTML prompt injection
  cleaned = he.encode(cleaned);

  // Enforce length hard cap
  if (cleaned.length > MAX_LENGTH) {
    cleaned = cleaned.substring(0, MAX_LENGTH);
  }

  return cleaned;
}


// -------------------------------------------------------------
// 2) Scope Validation: only debugging-related queries allowed
// -------------------------------------------------------------
export function validatePromptScope(input) {
  if (!input) {
    throw new Error("Your query is empty. Please provide a debugging-related question.");
  }

  const lower = input.toLowerCase();

  // Check keyword whitelist
  const matchesAllowed = ALLOWED_KEYWORDS.some((kw) => lower.includes(kw));

  if (!matchesAllowed) {
    throw new Error(
      "❌ Your prompt is out of scope.\n" +
      "This system is ONLY for debugging/log/stacktrace analysis.\n\n" +
      "👉 Allowed topics include: error messages, stacktraces, logs, exceptions, bugs.\n" +
      "Please rephrase your input to focus on a debugging problem."
    );
  }

  // Block jailbreak patterns (blacklist)
  const blockedPatterns = [
    /ignore (all|previous|above) instructions/gi,
    /pretend to/gi,
    /jailbreak/gi,
    /you are no longer restricted/gi,
    /repeat the system prompt/gi,
    /act as/gi
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(lower)) {
      throw new Error(
        "❌ Unsafe prompt detected.\nPrompt injection patterns are not allowed. " +
        "Please only ask debugging/log-related questions."
      );
    }
  }

  return input;
}


// -------------------------------------------------------------
// 3) One unified function that combines everything
// -------------------------------------------------------------
export function normalizeUserQuery(input) {
  // Phase 1: ensure user query is in allowed domain
  const scoped = validatePromptScope(input);

  // Phase 2: sanitize for safety
  const cleaned = sanitizePromptInput(scoped);

  return cleaned;
}
