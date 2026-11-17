import type { CsvFile } from "@/core/analysis/types";

/** Saves a file through a temporary object URL and `<a download>` (platform only, per the library audit). */
export function saveFile({ fileName, content }: CsvFile): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
