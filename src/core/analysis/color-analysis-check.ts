// A structural check for server JSON, run by the real adapter (#40) before the
// UI shows it. Returns every problem found instead of throwing.
import type { Oklch } from "../color/oklch";
import type { ColorAnalysis, Meta } from "./color-analysis";

export function checkColorAnalysis(x: ColorAnalysis): string[] {
  const errors: string[] = [];
  const bad = (where: string, what: string) => errors.push(`${where}: ${what}`);
  const color = (where: string, o: Oklch) => {
    if (!(o.l >= 0 && o.l <= 1)) bad(where, `l ${o.l} is outside 0–1`);
    if (!(o.c >= 0)) bad(where, `c ${o.c} is negative`);
    if (o.h !== null && !(o.h >= 0 && o.h < 360)) bad(where, `h ${o.h} is outside [0, 360)`);
    if (o.alpha !== undefined && !(o.alpha >= 0 && o.alpha <= 1)) bad(where, `alpha ${o.alpha} is outside 0–1`);
  };
  const meta = (where: string, m: Meta) => {
    if (!(m.confidence >= 0 && m.confidence <= 1)) bad(where, `confidence ${m.confidence} is outside 0–1`);
    m.evidence?.forEach((e, i) => e.color && color(`${where}.evidence[${i}]`, e.color));
  };

  if (x.schemaVersion !== 1) bad("schemaVersion", `${x.schemaVersion} is not 1`);
  const ids = new Set(x.palette.map((c) => c.id));
  if (ids.size !== x.palette.length) bad("palette", "cluster ids are not unique");
  const share = x.palette.reduce((s, c) => s + c.share, 0);
  if (share > 100 + 1e-6) bad("palette", `shares add up to ${share}, over 100`);
  x.palette.forEach((c, i) => {
    color(`palette[${i}]`, c.color);
    if (!(c.share >= 0 && c.share <= 100)) bad(`palette[${i}]`, `share ${c.share} is outside 0–100`);
    meta(`palette[${i}]`, c.meta);
  });
  const known = (where: string, id: string) => !ids.has(id) && bad(where, `unknown cluster ${id}`);

  const structureIds = new Set(x.structures.map((s) => s.id));
  x.structures.forEach((s, i) => {
    const at = `structures[${i}]`;
    if (!s.points.length) bad(at, "has no points");
    s.points.forEach((p, j) => {
      known(`${at}.points[${j}]`, p.clusterId);
      color(`${at}.points[${j}].ideal`, p.ideal);
      color(`${at}.points[${j}].actual`, p.actual);
      if (!(p.deltaE >= 0)) bad(`${at}.points[${j}]`, `deltaE ${p.deltaE} is negative`);
      if (s.template && p.spoke !== undefined && !(p.spoke >= 0 && p.spoke < s.template.offsets.length)) bad(`${at}.points[${j}]`, `spoke ${p.spoke} is not a template offset`);
    });
    if (!(s.coverage >= 0 && s.coverage <= 1)) bad(at, `coverage ${s.coverage} is outside 0–1`);
    if (!(s.score >= 0 && s.score <= 1)) bad(at, `score ${s.score} is outside 0–1`);
    s.nestedIn?.forEach((id) => !structureIds.has(id) && bad(at, `nestedIn unknown structure ${id}`));
    meta(at, s.meta);
  });

  x.contrast?.forEach((p, i) => {
    known(`contrast[${i}]`, p.fgClusterId);
    known(`contrast[${i}]`, p.bgClusterId);
    if (!(p.ratio >= 1 && p.ratio <= 21)) bad(`contrast[${i}]`, `ratio ${p.ratio} is outside 1–21`);
  });
  x.findings.forEach((f, i) => {
    f.clusterIds?.forEach((id) => known(`findings[${i}]`, id));
    f.structureIds?.forEach((id) => !structureIds.has(id) && bad(`findings[${i}]`, `unknown structure ${id}`));
    f.swatches?.forEach((s, j) => color(`findings[${i}].swatches[${j}]`, s.color));
    f.gradient?.forEach((g, j) => color(`findings[${i}].gradient[${j}]`, g.color));
    if (!f.title) bad(`findings[${i}]`, "has no title");
    meta(`findings[${i}]`, f.meta);
  });
  return errors;
}
