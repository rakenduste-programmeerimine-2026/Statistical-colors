"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useState, type FormEvent } from "react";
import { DEMO_ID } from "@/adapters/demo/with-demo";
import { useServices } from "@/adapters/services";
import { InvalidImageError } from "@/core/analysis/analysis-service";
import {
  ALLOWED_EXTENSIONS,
  INCLUDE_ALPHA_DEFAULT,
  MAX_UPLOAD_MB,
  TOP_N_DEFAULT,
  TOP_N_MAX,
  TOP_N_MIN,
  clampTopN,
  validateUpload,
  type UploadError,
} from "@/core/analysis/upload-rules";
import { PixelViewer } from "../preview/PixelViewer";
import { button, card, hint, input, label, primaryButton } from "../ui";

const MESSAGES: Record<UploadError | "invalid-image", string> = {
  "no-file": "Faili pole valitud.",
  "type-not-allowed": "Seda failitüüpi ei saa üles laadida. Vali tavaline pildiformaat.",
  "too-large": `Fail on liiga suur. Suurim lubatud suurus on ${MAX_UPLOAD_MB} MB.`,
  "invalid-image": "See fail ei paista olevat korrektne pilt.",
};

const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/** The demo opens with the colour count chosen on the form, like an upload (#90). */
function demoHref(topN: string): string {
  const n = clampTopN(topN);
  return n === TOP_N_DEFAULT ? `/results/${DEMO_ID}` : `/results/${DEMO_ID}?top_n=${n}`;
}

/** Upload form from the original upload.html: one image, alpha option and top N. */
export function UploadForm() {
  const { analysis } = useServices();
  const router = useRouter();
  const ids = { file: useId(), topN: useId() };
  const [file, setFile] = useState<File | null>(null);
  const [includeAlpha, setIncludeAlpha] = useState(INCLUDE_ALPHA_DEFAULT);
  const [topN, setTopN] = useState(String(TOP_N_DEFAULT));
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [extra, setExtra] = useState(0);
  /** A picked or dropped file goes the same way; the checks run on submit, as before. */
  const pick = (f: File | null, count: number) => {
    setFile(f);
    setExtra(Math.max(0, count - 1));
    setError(null);
  };

  // cacheComponents makes Next.js hide this page in <Activity> on navigation instead of unmounting it, and
  // "Töötle teine pilt" shows the same instance again. Hiding runs layout effect cleanups, so go back to idle
  // there; the picked file and options stay (#86).
  useLayoutEffect(
    () => () => {
      setProcessing(false);
      setError(null);
    },
    [],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateUpload(file);
    if (problem || !file) {
      setError(MESSAGES[problem ?? "no-file"]);
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const id = await analysis.analyze(file, { includeAlpha, topN: clampTopN(topN) });
      router.push(`/results/${encodeURIComponent(id)}`);
    } catch (err) {
      setProcessing(false);
      if (err instanceof InvalidImageError) setError(MESSAGES["invalid-image"]);
      else setError(`Töötlemine ebaõnnestus: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    }
  }

  return (
    <section className={card} aria-label="Pildi üleslaadimine">
      {error && (
        <p role="alert" className="my-2 rounded-lg border border-error p-2.5">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        {/* A large drop zone with a clear button, so the upload is easy to find (#91). */}
        <div
          data-testid="drop-zone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          // Moving over the box's own text fires dragleave too; only leaving the box counts.
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files;
            // One image at a time; several files at once stay in #15.
            if (dropped.length) pick(dropped[0], dropped.length);
          }}
          className={`mt-2 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${dragging ? "border-ink bg-ink/5" : "border-line"}`}
        >
          <p className="m-0 text-lg font-bold">Lohista pilt siia</p>
          <p className="m-0 text-muted">või</p>
          <input
            id={ids.file}
            className="peer sr-only"
            type="file"
            accept={ACCEPT}
            onChange={(e) => pick(e.target.files?.[0] ?? null, e.target.files?.length ?? 0)}
          />
          <label htmlFor={ids.file} className={`${primaryButton} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink`}>
            Vali pilt
          </label>
          <p className="m-0 text-sm" aria-live="polite">
            {file ? `Valitud: ${file.name}` : "Faili pole veel valitud."}
            {extra > 0 && <span className="block text-muted">Võeti esimene fail; korraga saab töödelda ühe pildi.</span>}
          </p>
        </div>
        {file && !validateUpload(file) && <PixelViewer source={file} name={file.name} />}

        <div className="flex flex-wrap gap-4">
          <div className="min-w-65 flex-1">
            <label className={label}>
              <input
                type="checkbox"
                className="mr-2"
                checked={includeAlpha}
                onChange={(e) => setIncludeAlpha(e.target.checked)}
              />
              Arvesta alfakanalit (RGBA)
            </label>
            <small className={hint}>Kui märgitud, loetakse värve RGBA-na ja CSV-s on veerg „a”.</small>
          </div>
          <div className="min-w-65 flex-1">
            <label htmlFor={ids.topN} className={label}>
              Mitu sagedasemat värvi tulemuste lehel näidata
            </label>
            <input
              id={ids.topN}
              className={`${input} mt-2`}
              type="number"
              min={TOP_N_MIN}
              max={TOP_N_MAX}
              step={1}
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
            />
            <small className={hint}>Mõjutab ainult lehte; kokkuvõtte CSV sisaldab kõiki värve.</small>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button type="submit" className={primaryButton} disabled={processing}>
            {processing ? "Töötlen…" : "Töötle pilti"}
          </button>
          <Link className={button} href={demoHref(topN)}>
            Ava demo
          </Link>
        </div>

        <p className={`${hint} mt-4`}>
          Suurim fail: {MAX_UPLOAD_MB} MB. Lubatud laiendid: {ALLOWED_EXTENSIONS.join(", ")}. Piksel-haaval CSV võib
          suurte piltide puhul olla väga suur.
        </p>
      </form>
    </section>
  );
}
