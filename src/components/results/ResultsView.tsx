"use client";

import type React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useServices } from "@/adapters/services";
import { clampTopN } from "@/core/analysis/upload-rules";
import type { CsvKind, ImageAnalysis } from "@/core/analysis/types";
import { PixelViewer } from "../preview/PixelViewer";
import { button, card } from "../ui";
import { Term } from "../Term";
import { ColorAnalysisSection } from "./ColorAnalysisSection";
import { ColorTableSection } from "./ColorTableSection";
import { GamutSection } from "./GamutSection";
import { saveFile } from "./download";

type Loaded = { status: "loading" } | { status: "missing" } | { status: "ready"; analysis: ImageAnalysis };

/** The original results.html: image summary, CSV downloads and the top-N table. */
const nf = new Intl.NumberFormat("et-EE");

function Stat({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="rounded-lg bg-line-soft/60 px-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="m-0 text-lg font-bold">{value}</dd>
    </div>
  );
}

export function ResultsView() {
  const { analysis: service } = useServices();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    service.getAnalysis(decodeURIComponent(id)).then((analysis) => {
      if (active) setLoaded(analysis ? { status: "ready", analysis } : { status: "missing" });
    });
    return () => {
      active = false;
    };
  }, [service, id]);

  if (loaded.status === "loading") return <p className={card}>Laen tulemusi…</p>;
  if (loaded.status === "missing") {
    return (
      <section className={card}>
        <p role="alert">Tulemust ei leitud. See võis aeguda või kustuda.</p>
        <Link className={`${button} mt-2.5`} href="/">
          Töötle teine pilt
        </Link>
      </section>
    );
  }

  const { analysis } = loaded;
  // The ?top_n= query overrides the value chosen on upload, as in the original.
  const topN = clampTopN(searchParams.get("top_n") ?? analysis.topN);

  async function download(kind: CsvKind) {
    setDownloadError(null);
    const file = await service.getCsv(analysis.id, kind);
    if (file) saveFile(file);
    else setDownloadError("Faili ei leitud.");
  }

  return (
    <>
      {analysis.simulated && (
        <p role="note" className={`${card} border-error`}>
          Näidisandmed: analüüsi taustateenus pole veel valmis, seega on need värvid genereeritud, mitte sinu pildist
          loetud.
        </p>
      )}

      {analysis.example && (
        <p role="note" className={card}>
          Näide: see on pildi „{analysis.fileName}” tegelik tulemus varasemast värvivalijate uuringust. Oma pildi
          analüüsimiseks laadi see üles avalehel.
        </p>
      )}

      <section className={card} aria-label="Pildi andmed">
        <h2 className="truncate text-lg font-bold" title={analysis.fileName}>
          {analysis.fileName}
        </h2>
        {/* Key figures first, in large type; nothing technical here (#90). */}
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Mõõdud" value={`${nf.format(analysis.width)} × ${nf.format(analysis.height)} px`} />
          <Stat label="Piksleid kokku" value={nf.format(analysis.totalPixels)} />
          <Stat label={<Term k="uniqueColors">Unikaalseid värve</Term>} value={nf.format(analysis.uniqueColors)} />
          <Stat label="Režiim" value={analysis.includeAlpha ? "RGBA (läbipaistvusega)" : "RGB"} />
        </dl>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          <button type="button" className={button} onClick={() => download("pixels")}>
            Laadi alla piksel-haaval CSV
          </button>
          <button type="button" className={button} onClick={() => download("summary")}>
            Laadi alla värvide kokkuvõtte CSV
          </button>
          <Link className={button} href="/">
            Töötle teine pilt
          </Link>
        </div>
        {downloadError && (
          <p role="alert" className="mt-2.5">
            {downloadError}
          </p>
        )}
      </section>

      {analysis.imageUrl && (
        <div className={card}>
          <PixelViewer source={analysis.imageUrl} name={analysis.fileName} />
        </div>
      )}

      {analysis.colorAnalysis && <ColorAnalysisSection analysis={analysis.colorAnalysis} />}

      <GamutSection
        key={`gamut-${analysis.id}`}
        colors={analysis.colors}
        topN={topN}
        coverage={analysis.colorAnalysis?.gamut}
        simulated={analysis.colorAnalysis?.status === "simulated"}
      />

      <ColorTableSection key={analysis.id} analysis={analysis} topN={topN} />
    </>
  );
}
