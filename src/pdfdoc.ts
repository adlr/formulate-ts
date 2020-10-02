// Copyright...

interface PDFium {
  openFile(): void;
  getPageCount(): number;
  render(pageno: number, outWidth: number, outHeight: number,
    a: number, b: number, c: number, d: number, e: number, f: number): number;
  freeBuf(buf: number): void;
}

declare var Module: any;

class PDFDoc {
  pdfium: PDFium;
  constructor(data) {
    // Get handle to pdfium

    this.pdfium = {
      openFile: Module.cwrap('OpenFile', 'number', ['number, number']),
      getPageCount: Module.cwrap('GetPageCount', null, []),
      render: Module.cwrap('Render', 'number', Array(9).fill('number')),
      freeBuf: Module.cwrap('FreeBuf', null, ['number']),
    }
  }
  public pageCount(canvas : HTMLCanvasElement): number {
    return 0;
  }
  public render(pageno: number, gl: WebGLRenderingContext, complete: any): void {

  }
}