import type { Metadata } from "next";
import { UserGuideClient } from "./user-guide-client";

export const metadata: Metadata = {
  title: "User Guide",
  description: "Step-by-step user guide for deploying a FrootAI solution play.",
};

export default function UserGuidePage() {
  return <UserGuideClient />;
}
