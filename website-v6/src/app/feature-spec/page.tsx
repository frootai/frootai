import type { Metadata } from "next";
import { FeatureSpecClient } from "./feature-spec-client";

export const metadata: Metadata = { title: "Feature Specification", description: "Complete feature specification for FrootAI — every feature from A to Z." };

export default function FeatureSpecPage() {
  return <FeatureSpecClient />;
}
