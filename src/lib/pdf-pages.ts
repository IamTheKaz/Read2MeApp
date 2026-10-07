import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const MAX_EDGE = 1600;
export const MAX_PDF_PAGES = 20;

let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  workerReady = true;
}

export type PdfImagePage = {
  src: string;
  name: string;
  width: number;
  height: number;
};

export type PdfProgress = {
  page: number;
  total: number;
};

/**
 * Rasterize a PDF into JPEG data URLs (one image per page), capped so a
 * classroom book still fits in the page store.
 */
export async function pdfFileToImages(
  file: File,
  onProgress?: (info: PdfProgress) => void,
): Promise<{ pages: PdfImagePage[]; truncated: boolean; totalInFile: number }> {
  ensureWorker();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const totalInFile = pdf.numPages;
  const total = Math.min(totalInFile, MAX_PDF_PAGES);
  const base = file.name.replace(/\.pdf$/i, "").trim() || "book";
  const pages: PdfImagePage[] = [];

  for (let n = 1; n <= total; n += 1) {
    onProgress?.({ page: n, total });
    const page = await pdf.getPage(n);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(1.6, MAX_EDGE / Math.max(unscaled.width, unscaled.height, 1));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw this PDF page.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      src: canvas.toDataURL("image/jpeg", 0.82),
      name: `${base}-p${n}.jpg`,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return { pages, truncated: totalInFile > MAX_PDF_PAGES, totalInFile };
}

export function bookNameFromPdf(file: File): string {
  const raw = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  return raw.slice(0, 80) || "Imported book";
}
