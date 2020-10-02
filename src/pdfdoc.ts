// Copyright...

interface PDFium {
  openFile(buf: number, size: number): void;
  getPageCount(): number;
  render(pageno: number, outWidth: number, outHeight: number,
    a: number, b: number, c: number, d: number, e: number, f: number): number;
  freeBuf(buf: number): void;
}

declare var Module: any;

export default class PDFDoc {
  #pdfium: PDFium;
  constructor(data: Uint8Array) {
    // Get handle to pdfium

    this.#pdfium = {
      openFile: Module.cwrap('OpenFile', 'number', ['number, number']),
      getPageCount: Module.cwrap('GetPageCount', 'number', []),
      render: Module.cwrap('Render', 'number', Array(9).fill('number')),
      freeBuf: Module.cwrap('FreeBuf', null, ['number']),
    }
    const buf: number = Module._malloc(data.length);
    Module.HEAPU8.set(data, buf);
    this.#pdfium.openFile(buf, data.length);
    Module._free(buf);
  }
  public pageCount(): number {
    return this.#pdfium.getPageCount();
  }
  public render(pageno: number, gl: WebGLRenderingContext, complete: any): void {

  }
}