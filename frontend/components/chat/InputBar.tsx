// components/chat/InputBar.tsx
"use client";
import { useState } from "react";
import { useChatStore } from '../../lib/store/chatStore';
import { useUIStore } from "../../lib/store/uiStore";
import { ArrowUpIcon } from "@heroicons/react/24/solid";

export default function InputBar() {
  const [text, setText] = useState("");
  const { sendMessage, receiveMessage } = useChatStore();
  const { inputBarCentered, dockInput, sidebarOpen } = useUIStore();

  const scrollToBottom = () => {
    const el = typeof document !== "undefined" ? document.getElementById("chat-bottom-sentinel") : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  

  const handleSend = async () => {
    if (!text.trim()) return;
    
    // Dock the input bar to bottom on first send
    if (inputBarCentered) {
      dockInput();
    }
    
    sendMessage(text);
    setText("");
    
    // Temporary fake AI reply (increased delay so loading indicator is visible)
    // setTimeout(() => {
    //   receiveMessage("Natick Center station is an MBTA Commuter Rail station in Natick, Massachusetts, United States. Served by the Framingham/Worcester Line, it is located below grade in an open cut. The accessible station has two side platforms flanking the two tracks of the Worcester Main Line, with entrances from North Main Street (Route 27) and Washington Street. The Boston and Worcester Railroad (B&W) opened through Natick in 1834; a station was established by 1838 and modified around 1845. The Saxonville Branch opened between Natick and Saxonville in 1846. Around 1875, the Boston and Albany Railroad (B&A) built a new station slightly east. In 1895–1896, the railroad lowered the tracks through Natick to eliminate grade crossings. A new station building designed by Alexander Wadsworth Longfellow Jr. was completed in 1897. B&A passenger service peaked in the early 1910s and declined thereafter. Saxonville Branch passenger service ended in 1936. Natick station was briefly closed in 1960 as part of service cuts. In 1962, a commercial building was built over the station building. The Massachusetts Bay Transportation Authority (MBTA) was formed in 1964 and began subsidizing service on the line in 1973. New platforms were paved around 1982. The Worcester Main Line runs approximately east-west in a trench through downtown Natick. It has two tracks with space reserved between for a future third track. The accessible station has two 800-foot (240 m)-long side platforms flanking the tracks. A footbridge crosses over the trench at Walnut Street, near the midpoint of the platforms, with an elevator and stairs to each platform. At the east end of the platforms, switchback ramps and stairs lead to the Washington Street bridge. The Cochituate Rail Trail connects to the west end of the outbound (north) platform with stairs to North Main Street.[3] A 71-space town-owned parking lot for permit holders is located at Mulligan Street several blocks east of the station.[4][5]");
    // }, 1200);

    try {
    // 👇 Use full URL to your Express backend
    const response = await fetch('http://localhost:4000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      receiveMessage(data.reply);
    } else {
      receiveMessage(`Error: ${data.error || 'Unknown error'}`);
      console.error('Backend error:', data);
    }
  } catch (error) {
    console.error('Network error:', error);
    receiveMessage('Failed to connect to the server. Is it running?');
  }
  };

  // Centered mode: centered between sidebar and screen edge
  if (inputBarCentered) {
    // Calculate the left offset based on sidebar state
    const sidebarWidth = sidebarOpen ? 256 : 64; // w-64 = 256px, w-16 = 64px
    const availableWidth = `calc(100% - ${sidebarWidth}px)`;
    
    return (
      <div 
        className="fixed top-1/2 -translate-y-1/2 transition-all duration-300"
        style={{
          left: `${sidebarWidth}px`,
          width: availableWidth,
        }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-gray-500 text-3xl font-medium text-center mb-6">
            Start a new debug session.
          </h1>
          <div className="relative">
            <textarea
             className="w-full min-h-[100px] max-h-40 resize-none 
             border border-gray-300 rounded-xl 
             py-3 px-4 bg-gray-50 
             focus:outline-none focus:ring-2 focus:ring-blue-500 
             shadow-sm transition-shadow duration-200
             placeholder:text-gray-500 text-gray-800
             font-sans text-sm"
              placeholder="Ask something… paste logs… describe an error…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="absolute right-2 bottom-0 -translate-y-1/2 
                         bg-blue-600 text-white p-2 rounded-lg 
                         hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              <ArrowUpIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Docked mode: with container at bottom
  return (
    <div className="p-4 border-t bg-white">
      {/* (scroll-to-bottom icon removed) */}
      <div className="relative max-w-4xl mx-auto">
        <input
          className="w-full border border-gray-300 rounded-xl py-3 pl-4 pr-12 bg-gray-50
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ask something… paste logs… describe an error…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 
                     bg-blue-600 text-white p-2 rounded-lg 
                     hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
        >
          <ArrowUpIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}