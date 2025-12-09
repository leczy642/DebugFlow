// lib/store/chatStore.ts
import { create } from "zustand";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatStore = {
  messages: Message[];
  sendMessage: (content: string) => void;
  receiveMessage: (content: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],

  sendMessage: (content) =>
    set((state) => ({
      messages: [...state.messages, { role: "user", content }],
    })),

  receiveMessage: (content) =>
    set((state) => ({
      messages: [...state.messages, { role: "assistant", content }],
    })),
}));
