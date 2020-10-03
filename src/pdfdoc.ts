// Copyright...

import { Size } from "./geometry";

interface PDFium {
  openFile(buf: number, size: number): void;
  getPageCount(): number;
  getPageWidth(pageno: number): number;
  getPageHeight(pageno: number): number;
  render(pageno: number, outWidth: number, outHeight: number,
    a: number, b: number, c: number, d: number, e: number, f: number): number;
  freeBuf(buf: number): void;
}

declare function createPDFLib(): Promise<any>;

export default class PDFDoc {
  #pdfium: PDFium;
  private static module: any = null;
  
  static async initLib() {
    PDFDoc.module = await createPDFLib();
  }

  constructor(data: Uint8Array) {
    if (PDFDoc.module === null) {
      throw new Error('PDFDoc not initialiez');
    }
    this.#pdfium = {
      openFile: PDFDoc.module.cwrap('OpenFile', 'number', ['number, number']),
      getPageCount: PDFDoc.module.cwrap('GetPageCount', 'number', []),
      getPageWidth: PDFDoc.module.cwrap('GetPageWidth', 'number', ['number']),
      getPageHeight: PDFDoc.module.cwrap('GetPageHeight', 'number', ['number']),
      render: PDFDoc.module.cwrap('Render', 'number', Array(9).fill('number')),
      freeBuf: PDFDoc.module.cwrap('FreeBuf', null, ['number']),
    }
    const buf: number = PDFDoc.module._malloc(data.length);
    PDFDoc.module.HEAPU8.set(data, buf);
    this.#pdfium.openFile(buf, data.length);
    PDFDoc.module._free(buf);
  }
  public pageCount(): number {
    return this.#pdfium.getPageCount();
  }
  public pageSize(pageno: number): Size {
    return new Size(this.#pdfium.getPageWidth(pageno),
                    this.#pdfium.getPageHeight(pageno));
  }
  public render(pageno: number, gl: WebGLRenderingContext, complete: any): void {

  }
}