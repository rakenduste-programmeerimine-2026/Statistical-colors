import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServicesProvider } from "@/adapters/services";
import { AnalysisFailedError } from "@/core/analysis/analysis-service";
import { MAX_UPLOAD_BYTES } from "@/core/analysis/upload-rules";
import { renderWithServices, testServices } from "@/test/render";
import { UploadForm } from "./UploadForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// The preview decodes with browser APIs jsdom lacks; it has its own tests.
vi.mock("../preview/PixelViewer", () => ({
  PixelViewer: ({ name }: { name: string }) => <p data-testid="preview">{name}</p>,
}));

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

// With cacheComponents, Next.js hides a page in <Activity> on navigation and shows the same instance on return (#86).
describe("UploadForm hidden by Next.js", () => {
  beforeEach(() => push.mockReset());

  function renderInActivity() {
    const services = testServices();
    const page = (mode: "visible" | "hidden") => (
      <ServicesProvider services={services}>
        <Activity mode={mode}>
          <UploadForm />
        </Activity>
      </ServicesProvider>
    );
    const { rerender } = render(page("visible"));
    return { hideAndShow: () => (rerender(page("hidden")), rerender(page("visible"))) };
  }

  it("is idle again after opening the results and coming back", async () => {
    const { hideAndShow } = renderInActivity();
    await submitWith(file("a.png"));
    await waitFor(() => expect(push).toHaveBeenCalledOnce());

    hideAndShow();

    expect(screen.getByRole("button", { name: "Töötle pilti" })).toBeEnabled();
    expect(screen.getByTestId("preview")).toHaveTextContent("a.png");
  });

  it("drops the old error message", async () => {
    const { hideAndShow } = renderInActivity();
    await submitWith();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    hideAndShow();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("UploadForm preview and demo", () => {
  it("previews the picked file before it is sent", async () => {
    renderWithServices(<UploadForm />);
    expect(screen.queryByTestId("preview")).not.toBeInTheDocument();

    await user().upload(screen.getByLabelText("Vali pilt"), file("palette.bmp"));

    expect(screen.getByTestId("preview")).toHaveTextContent("palette.bmp");
    expect(push).not.toHaveBeenCalled();
  });

  it.each([["scan.tiff"], ["huge.png", 25 * 1024 * 1024 + 1]])(
    "does not preview %s, which the upload rules reject",
    async (name, size?: number) => {
      renderWithServices(<UploadForm />);
      await user().upload(screen.getByLabelText("Vali pilt"), file(name, size));
      expect(screen.queryByTestId("preview")).not.toBeInTheDocument();
    },
  );

  it("links to the demo result", () => {
    renderWithServices(<UploadForm />);
    expect(screen.getByRole("link", { name: "Ava demo" })).toHaveAttribute("href", "/results/demo");
  });

  it("opens the demo with the colour count chosen on the form (regression #90)", async () => {
    renderWithServices(<UploadForm />);
    const count = screen.getByLabelText("Mitu sagedasemat värvi tulemuste lehel näidata");
    await user().clear(count);
    await user().type(count, "100");
    expect(screen.getByRole("link", { name: "Ava demo" })).toHaveAttribute("href", "/results/demo?top_n=100");
  });
});
