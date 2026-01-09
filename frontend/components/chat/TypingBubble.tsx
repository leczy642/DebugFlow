// components/chat/TypingBubble.tsx
/**
 * TypingBubble.tsx
 * -----------------------------------------------------------------------------
 * PURPOSE:
 * Renders a visual indicator that simulates typing activity when the AI is
 * processing or generating a response. Provides user feedback that the system
 * is actively working on a reply.
 *
 * ROLE IN PROJECT:
 * - User experience component for indicating active processing states
 * - Visual feedback during AI response generation
 * - Placeholder element that appears while streaming is in progress
 * - Part of the chat interface's real-time interaction feedback system
 *
 * WHAT THIS FILE DOES:
 * 1. Displays three animated dots with sequential pulsing animation
 * 2. Uses CSS animations with staggered delays to create typing effect
 * 3. Renders within message bubble styling consistent with assistant messages
 * 4. Provides clear visual indication that content is being generated
 *
 * INPUTS:
 * - None (stateless component with no props)
 *
 * OUTPUTS:
 * - Visual typing indicator with animated dots
 * - Styled bubble container matching assistant message appearance
 *
 * IMPORTANT:
 * This component is purely presentational with no internal state.
 * The animation delays create a realistic typing effect that signals
 * activity without requiring actual content to be displayed.
 * The component should only be shown when the AI is actively generating
 * a response (typically during streaming).
 * -----------------------------------------------------------------------------
 */

"use client";
import React from "react";

export default function TypingBubble() {
  return (
    <div className="flex items-start mb-3">
      {/* Typing bubble container - matches assistant message styling */}
      <div className="bg-gray-100 text-gray-700 px-4 py-2 rounded-2xl inline-flex items-center">
        {/* Animated dots with staggered delays for typing effect */}
        <span
          className="dot h-2 w-2 bg-gray-500 rounded-full mr-1 animate-pulse"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="dot h-2 w-2 bg-gray-500 rounded-full mr-1 animate-pulse"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="dot h-2 w-2 bg-gray-500 rounded-full animate-pulse"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}