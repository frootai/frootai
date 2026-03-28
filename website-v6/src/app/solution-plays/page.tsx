import type { Metadata } from "next";
import { SolutionPlaysClient } from "./solution-plays-client";

export const metadata: Metadata = {
  title: "Solution Plays",
  description: "20 pre-tuned deployable AI solutions. DevKit empowers the builder. TuneKit ships it to production.",
};

export default function SolutionPlaysPage() {
  return <SolutionPlaysClient />;
}
