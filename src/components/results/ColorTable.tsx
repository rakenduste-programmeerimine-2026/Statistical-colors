import { cssColor, formatHex, formatPercent, formatTuple } from "@/core/analysis/format";
import type { ColorCount } from "@/core/analysis/types";
import { topArtefact } from "@/core/analysis/color-filter";
import { FINDING_LABELS } from "@/core/analysis/ontology";
import { formatOklch, srgbToOklch } from "@/core/color/oklch";

interface Props {
  colors: ColorCount[];
  includeAlpha: boolean;
}

/** The top-N table from the original results.html. */
export function ColorTable({ colors, includeAlpha }: Props) {
  const cell = "border-b border-line-soft p-2 text-left align-middle";
  return (
    <table className="mt-3 w-full border-collapse">
      <thead>
        <tr>
          {["Näidis", includeAlpha ? "RGBA" : "RGB", includeAlpha ? "Hex + alfa" : "Hex", "OKLCH", "Kogus", "Osakaal pildist", "Segupiksel / artefakt"].map(
            (h) => (
              <th key={h} className={`${cell} sticky top-0 bg-page`}>
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {colors.map((c) => (
          <tr key={formatHex(c)}>
            <td className={cell}>
              {/* Swatches show the analysed image data in sRGB, so they stay rgb() (P-011). */}
              <span
                aria-hidden
                className="inline-block size-5.5 rounded-md border border-ink/25 align-middle"
                style={{ background: cssColor(c) }}
              />
            </td>
            <td className={`${cell} font-mono`}>{formatTuple(c)}</td>
            <td className={`${cell} font-mono`}>{formatHex(c)}</td>
            <td className={`${cell} font-mono`}>{formatOklch(srgbToOklch(c))}</td>
            <td className={`${cell} font-mono`}>{c.count}</td>
            <td className={`${cell} font-mono`}>{formatPercent(c.percent)}</td>
            <td className={cell}>
              <ArtefactCell color={c} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The most likely artefact the server reported for a colour (P-032); "—" when there is none. */
function ArtefactCell({ color }: { color: ColorCount }) {
  const top = topArtefact(color);
  if (!top) return <span className="text-muted">—</span>;
  const label = FINDING_LABELS[top.kind] ?? top.kind;
  const percent = Math.round(top.chance * 100);
  return (
    <span className="flex items-center gap-2 text-sm">
      <meter min={0} max={1} low={0.5} high={0.5} optimum={0} value={top.chance} aria-label={`${label}: ${percent} %`} className="h-2 w-14" />
      <span className="font-mono">{percent} %</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}
