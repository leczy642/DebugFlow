//sanitize and escape user input to prevent from injecting malicious characters in prompt into LLM prompts
export function sanitizePromptInput(input) {
    if (!input) return "";
  
    let safe = input;
  
    // 1. Remove control characters (except newline, tab)
    safe = safe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
    // 2. Escape special characters that may break prompt formatting
    safe = safe
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");
  
    // 3. Prevent prompt injection keywords from being interpreted
    safe = safe.replace(/(ignore|disregard|override|system:|assistant:)/gi, match => {
      return `«${match}»`; // visually preserved but neutralized
    });
  
    // 4. Limit input length (prevents prompt explosion attacks)
    const MAX_INPUT_LENGTH = 5000;
    if (safe.length > MAX_INPUT_LENGTH) {
      safe = safe.substring(0, MAX_INPUT_LENGTH) + "…[TRUNCATED]";
    }
  
    return safe;
  }
  