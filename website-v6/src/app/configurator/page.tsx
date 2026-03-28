import type { Metadata } from "next";
import { ConfiguratorClient } from "./configurator-client";

export const metadata: Metadata = {
  title: "Solution Configurator",
  description: "Answer 3 questions and get a personalized AI solution play recommendation.",
};

export default function ConfiguratorPage() {
  return <ConfiguratorClient />;
}
