import { cssColor, formatHex, formatPercent, formatTuple } from "@/core/analysis/format";
import type { ColorCount } from "@/core/analysis/types";
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
          {["Näidis", includeAlpha ? "RGBA" : "RGB", includeAlpha ? "Hex + alfa" : "Hex", "OKLCH", "Kogus", "Osakaal pildist"].map(
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
