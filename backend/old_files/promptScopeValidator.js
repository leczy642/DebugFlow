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
  