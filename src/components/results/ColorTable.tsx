import { memo, type ReactNode } from "react";
import { Term } from "../Term";
import {
  cssColor,
  formatOpacity,
  formatPercent,
  formatTuple,
  hexOf,
} from "@/core/analysis/format";
import type { ColorCount } from "@/core/analysis/types";
import { topArtefact } from "@/core/analysis/color-filter";
import { formatOklch, srgbToOklch } from "@/core/color/oklch";
import { ColorName } from "../ColorName";

interface Props {
  colors: ColorCount[];
  includeAlpha: boolean;
}

/** One cell style for every column: values stay on one line (#90). */
const cell =
  "whitespace-nowrap border-b border-line-soft px-2 py-1.5 text-left align-middle";

/** Column headings; colour terms explain themselves on hover, focus or tap (#90). */
const headers = (includeAlpha: boolean): [string, ReactNode][] => [
  ["swatch", "Näidis"],
  ["rgb", <Term key="t" k="srgb">{includeAlpha ? "RGBA" : "RGB"}</Term>],
  ["hex", <Term key="t" k="hex">Hex</Term>],
  ["oklch", <Term key="t" k="oklch">OKLCH</Term>],
  ["count", "Kogus"],
  ["share", <Term key="t" k="share">Osakaal pildist</Term>],
  ["blend", <Term key="t" k="blendSimilarity">Segupiksli sarnasus</Term>],
];

/** The top-N table from the original results.html. */
export function ColorTable({ colors, includeAlpha }: Props) {
  return (
    // Wide tables scroll sideways inside their box instead of wrapping values (#90).
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers(includeAlpha).map(([key, h]) => (
              <th key={key} scope="col" className={`${cell} sticky top-0 bg-page`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colors.map((c) => (
            <Row key={`${c.r},${c.g},${c.b},${c.a ?? ""}`} c={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One row. Memoised on the colour object, so a filter change only builds the
 * rows that are new; the OKLCH conversion runs once per row (#90).
 */
const Row = memo(function Row({ c }: { c: ColorCount }) {
  return (
    <tr>
      <td className={cell}>
        {/* Swatches show the analysed image data in sRGB, so they stay rgb() (P-011). */}
        <span
          aria-hidden
          className="inline-block size-5.5 rounded-md border border-ink/25 align-middle"
          style={{ background: cssColor(c) }}
        />
      </td>
      <td className={`${cell} font-mono`}>{formatTuple(c)}</td>
      <td className={`${cell} font-mono`}>
        {hexOf(c)}
        <ColorName color={c} className="ml-2 text-sm" />
        {c.a !== undefined && (
          <span className="ml-2 font-sans text-sm text-muted">
            {formatOpacity(c.a)}
          </span>
        )}
      </td>
      <td className={`${cell} font-mono`}>{formatOklch(srgbToOklch(c))}</td>
      <td className={`${cell} font-mono`}>{c.count}</td>
      <td className={`${cell} font-mono`}>{formatPercent(c.percent)}</td>
      <td className={cell}>
        <ArtefactCell color={c} />
      </td>
    </tr>
  );
});

/**
 * How closely the colour matches an antialias blend between two frequent
 * colours (P-039 item 2): a similarity score, not a probability. A fixed-width
 * bar and number that never spread into the next column (#90); "—" for 0.
 */
function ArtefactCell({ color }: { color: ColorCount }) {
  const top = topArtefact(color);
  if (!top || top.chance <= 0) return <span className="text-muted">—</span>;
  const percent = Math.round(top.chance * 100);
  return (
    <span
      className="inline-flex w-36 shrink-0 items-center gap-2 text-sm"
      role="img"
      aria-label={`Segupiksli sarnasus ${percent} %`}
    >
      <span
        aria-hidden
        className="block h-2 w-20 shrink-0 overflow-hidden rounded-full bg-line-soft"
      >
        <span
          className="block h-full rounded-full bg-ink/60"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="font-mono">{percent} %</span>
    </span>
  );
}
