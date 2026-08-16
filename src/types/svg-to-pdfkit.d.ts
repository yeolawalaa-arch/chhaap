/**
 * svg-to-pdfkit ships no types. Only the single call signature we use is
 * declared, so a wrong argument is still a compile error.
 */
declare module "svg-to-pdfkit" {
  interface SVGtoPDFOptions {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    useCSS?: boolean;
    fontCallback?: (family: string, bold: boolean, italic: boolean) => string;
    imageCallback?: (link: string) => string;
    colorCallback?: (color: unknown, raw: string) => unknown;
    warningCallback?: (message: string) => void;
    assumePt?: boolean;
    precision?: number;
  }

  function SVGtoPDF(
    doc: PDFKit.PDFDocument,
    svg: string,
    x?: number,
    y?: number,
    options?: SVGtoPDFOptions,
  ): void;

  export = SVGtoPDF;
}
