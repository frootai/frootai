import type { Metadata } from "next";
import { HiFaiClient } from "./hi-fai-client";

export const metadata: Metadata = {
  title: "Hi FAI — Quickstart",
  description: "5-minute quickstart guide to FrootAI. Install, configure, and deploy your first AI solution.",
};

export default function HiFaiPage() {
  return <HiFaiClient />;
}
