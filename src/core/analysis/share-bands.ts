// Share bands: rough percentage clusters of the colour list, used as an
// equivalence-class filter on the results table (P-032, P-033 items 2 and 6).
// Presentation arithmetic on shares the server sent; no colour clustering.

export interface ShareBand {
  id: string;
  /** Smallest and largest share in the band, 0–100. */
  min: number;
  max: number;
  count: number;
  label: string;
}

/** A gap of at least this many decades in the sorted log shares starts a new band. */
export const BAND_GAP = 0.5;
export const MAX_BANDS = 6;
const EPS = 1e-9;

const log = (p: number) => Math.log10(Math.max(p, 1e-12));

/** Short percentage text: 2 significant digits below 10, whole numbers above. */
export function formatShare(p: number): string {
  if (p >= 10) return p.toFixed(0);
  if (p >= 1) return p.toFixed(1);
  if (p <= 0) return "0";
  return p.toFixed(Math.min(8, Math.ceil(-Math.log10(p)) + 1));
}

function band(id: string, members: number[]): ShareBand {
  const min = Math.min(...members);
  const max = Math.max(...members);
  const label = min === max ? `${formatShare(min)} %` : `${formatShare(min)}–${formatShare(max)} %`;
  return { id, min, max, count: members.length, label };
}

/**
 * Splits the shares into bands, largest shares first. Splits at gaps of at least
 * 0.5 decades in the sorted log shares, keeping the 5 widest gaps (at most 6
 * bands). With no such gap, falls back to decade bands (≥ 10 %, 1–10, 0.1–1,
 * 0.01–0.1, < 0.01), leaving out empty ones.
 */
export function shareBands(percents: number[]): ShareBand[] {
  if (percents.length === 0) return [];
  const sorted = [...percents].sort((a, b) => b - a);
  const gaps = sorted
    .slice(1)
    .map((p, i) => ({ at: i + 1, size: log(sorted[i]) - log(p) }))
    .filter((g) => g.size >= BAND_GAP - EPS)
    .sort((a, b) => b.size - a.size || a.at - b.at)
    .slice(0, MAX_BANDS - 1)
    .map((g) => g.at)
    .sort((a, b) => a - b);

  if (gaps.length > 0) {
    const cuts = [0, ...gaps, sorted.length];
    return cuts.slice(1).map((end, i) => band(`gap-${i}`, sorted.slice(cuts[i], end)));
  }

  const decades: [string, (p: number) => boolean][] = [
    ["d-10", (p) => p >= 10],
    ["d-1", (p) => p >= 1 && p < 10],
    ["d-0.1", (p) => p >= 0.1 && p < 1],
    ["d-0.01", (p) => p >= 0.01 && p < 0.1],
    ["d-small", (p) => p < 0.01],
  ];
  return decades.flatMap(([id, test]) => {
    const members = sorted.filter(test);
    return members.length ? [band(id, members)] : [];
  });
}

/** The band a share belongs to; bands do not overlap, so there is at most one. */
export function bandOf(bands: ShareBand[], percent: number): ShareBand | undefined {
  return bands.find((b) => percent >= b.min && percent <= b.max);
}
