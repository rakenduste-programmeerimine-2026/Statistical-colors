import type { Metadata } from "next";
import { Suspense } from "react";
import { card } from "@/components/ui";
import { ResultsView } from "@/components/results/ResultsView";

export const metadata: Metadata = { title: "Tulemused – Värvi tükeldaja" };

export default function ResultsPage() {
  return (
    <main className="mx-auto w-full max-w-275 p-8">
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Tulemused</h1>
      <Suspense fallback={<p className={card}>Laen tulemusi…</p>}>
        <ResultsView />
      </Suspense>
    </main>
  );
}
