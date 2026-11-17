import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisFailedError } from "@/core/analysis/analysis-service";
import { MAX_UPLOAD_BYTES } from "@/core/analysis/upload-rules";
import { renderWithServices, testServices } from "@/test/render";
import { UploadForm } from "./UploadForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// Let the test pick files the `accept` filter would hide, to check our own validation.
const user = () => userEvent.setup({ applyAccept: false });

function file(name: string, size = 10) {
  const f = new File([new Uint8Array(Math.min(size, 10))], name, { type: "image/png" });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

async function submitWith(picked?: File) {
  const u = user();
  if (picked) await u.upload(screen.getByLabelText("Vali pilt"), picked);
  await u.click(screen.getByRole("button", { name: "Töötle pilti" }));
}

describe("UploadForm", () => {
  beforeEach(() => push.mockReset());

  it("asks for a file when none is picked", async () => {
    renderWithServices(<UploadForm />);
    await submitWith();
    expect(screen.getByRole("alert")).toHaveTextContent("Faili pole valitud.");
    expect(push).not.toHaveBeenCalled();
  });

  it("rejects a file type the original did not allow for browsers", async () => {
    renderWithServices(<UploadForm />);
    await submitWith(file("scan.tiff"));
    expect(screen.getByRole("alert")).toHaveTextContent("Seda failitüüpi ei saa üles laadida");
  });

  it("rejects files over 25 MB", async () => {
    renderWithServices(<UploadForm />);
    await submitWith(file("big.png", MAX_UPLOAD_BYTES + 1));
    expect(screen.getByRole("alert")).toHaveTextContent("Suurim lubatud suurus on 25 MB");
  });

  it("reports a file that is not a valid image", async () => {
    renderWithServices(<UploadForm />);
    await submitWith(file("empty.png", 0));
    expect(screen.getByRole("alert")).toHaveTextContent("See fail ei paista olevat korrektne pilt.");
  });

  it("reports other failures with their name and message", async () => {
    const services = testServices();
    vi.spyOn(services.analysis, "analyze").mockRejectedValue(new AnalysisFailedError("boom"));
    renderWithServices(<UploadForm />, services);
    await submitWith(file("a.png"));
    expect(screen.getByRole("alert")).toHaveTextContent("Töötlemine ebaõnnestus: AnalysisFailedError: boom");
  });

  it("sends the options, clamps top N and opens the results page", async () => {
    const services = testServices();
    const analyze = vi.spyOn(services.analysis, "analyze");
    renderWithServices(<UploadForm />, services);
    const u = user();

    await u.click(screen.getByLabelText("Arvesta alfakanalit (RGBA)"));
    const topN = screen.getByLabelText("Mitu sagedasemat värvi tulemuste lehel näidata");
    await u.clear(topN);
    await u.type(topN, "0");
    await submitWith(file("photo.png"));

    expect(analyze).toHaveBeenCalledWith(expect.any(File), { includeAlpha: true, topN: 1 });
    const id = await analyze.mock.results[0].value;
    expect(push).toHaveBeenCalledWith(`/results/${id}`);
  });

  it("defaults to RGB and top 5000", async () => {
    const services = testServices();
    const analyze = vi.spyOn(services.analysis, "analyze");
    renderWithServices(<UploadForm />, services);
    await submitWith(file("photo.png"));
    expect(analyze).toHaveBeenCalledWith(expect.any(File), { includeAlpha: false, topN: 5000 });
  });
});
