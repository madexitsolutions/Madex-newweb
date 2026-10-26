import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalysisView } from "@/components/analyse/AnalysisView";
import { getReport, toView } from "@/lib/server/analysis/engine";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ihre Website-Analyse",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Live scan and finished report of one analysis; the token in ?t= is the access key. */
export default async function AnalysisPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  const report = t ? await getReport(id, t) : null;
  if (!report || !t) notFound();
  return <AnalysisView initial={toView(report)} token={t} />;
}
