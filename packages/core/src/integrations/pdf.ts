/**
 * Plain-text PDF extraction via pdf-parse.
 *
 * Scanned PDFs (image-only, no embedded text layer) come back empty — by
 * design. We do not OCR images here; capture them as `image` kind if you
 * want OCR. Future work: render PDF pages to images and OCR per-page.
 *
 * pdf-parse's main entry tries to open a sample test file on import, which
 * crashes outside its own repo. The internal entry point at
 * `pdf-parse/lib/pdf-parse.js` skips that, which is the standard workaround.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type PdfParseFn = (buf: Buffer, options?: unknown) => Promise<{ text: string; numpages: number }>;

let pdfParse: PdfParseFn | null = null;
function getPdfParse(): PdfParseFn {
  if (!pdfParse) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    pdfParse = require("pdf-parse/lib/pdf-parse.js") as PdfParseFn;
  }
  return pdfParse;
}

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const result = await getPdfParse()(buffer);
  return { text: (result.text ?? "").trim(), pages: result.numpages ?? 0 };
}
