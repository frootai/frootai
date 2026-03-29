import { notFound } from "next/navigation";
import { getAllSlugs } from "./play-data";
import { PlayPageClient } from "./play-page-client";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const allSlugs = getAllSlugs();
  if (!allSlugs.includes(slug)) notFound();
  return <PlayPageClient slug={slug} />;
}
