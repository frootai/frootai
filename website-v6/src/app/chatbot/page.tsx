import type { Metadata } from "next";
import { ChatbotClient } from "./chatbot-client";

export const metadata: Metadata = {
  title: "Agent FAI",
  description: "AI-powered architecture guide. Grounded in 20 solution plays, 22 MCP tools, 18 knowledge modules.",
};

export default function ChatbotPage() {
  return <ChatbotClient />;
}
