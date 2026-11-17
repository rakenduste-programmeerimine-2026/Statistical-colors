// S3 · A vector PDF painted by the browser itself. Needs the debugger.
// The whole document is printed as one page with screen styles, so the viewport
// is the region of that page starting at (scrollX, scrollY).
import type { ApproachResult, Context } from "../core/pipeline.ts";

export type S3Result = ApproachResult & { pdf: Uint8Array };

/** Chrome's printToPDF takes inches; 96 CSS px make an inch. Pages stop at 200 inches. */
export const pdfPaper = (docW: number, docH: number) => ({ paperWidth: docW / 96, paperHeight: Math.min(200, docH / 96) });

export const S3 = {
  id: "S3",
  title: "Vector PDF",
  needsDebugger: true,
  async run(ctx: Context): Promise<S3Result> {
    const { host } = ctx;
    const info = await ctx.info();
    await host.cdp("Emulation.setEmulatedMedia", { media: "screen" });
    let data: string;
    try {
      ({ data } = await host.cdp<{ data: string }>("Page.printToPDF", {
        printBackground: true,
        preferCSSPageSize: false,
        ...pdfPaper(info.docW, info.docH),
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        pageRanges: "1",
      }));
    } finally {
      await host.cdp("Emulation.setEmulatedMedia", { media: "" });
    }
    await ctx.save("page.pdf", { base64: data, type: "application/pdf" });
    const bin = atob(data);
    const pdf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) pdf[i] = bin.charCodeAt(i);
    return {
      pdf,
      report: { bytes: pdf.length, pageCssSize: [info.docW, info.docH], viewportOffset: [info.scrollX, info.scrollY] },
    };
  },
};
