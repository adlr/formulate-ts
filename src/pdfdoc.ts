// Copyright...

import { mat3 } from "gl-matrix";
import { Rect, Size } from "./geometry";
import { Texture } from "./glcontroller";

interface PDFium {
  openFile(buf: number, size: number): void;
  getPageCount(): number;
  getPageWidth(pageno: number): number;
  getPageHeight(pageno: number): number;
  addTextOverlayToPage(pageno: number, bytes: number, length: number, left: number, bottom: number, html: string, width: number): void;
  reducePageObjects(pageno: number, finalPageobjCount: number);
  pageCountObjects(pageno: number): number;
  generagePageContent(pageno: number): void;
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
      addTextOverlayToPage: PDFDoc.module.cwrap('AddTextOverlayToPage', null, ['number', 'number', 'number', 'number',  'number', 'string', 'number']),
      reducePageObjects: PDFDoc.module.cwrap('ReducePageObjects', null, ['number', 'number']),
      pageCountObjects: PDFDoc.module.cwrap('PageCountObjects', 'number', ['number']),
      generagePageContent: PDFDoc.module.cwrap('GeneragePageContent', null, ['number']),
      render: PDFDoc.module.cwrap('Render', 'number', Array(9).fill('number')),
      freeBuf: PDFDoc.module.cwrap('FreeBuf', null, ['number']),
    }
    const buf: number = PDFDoc.module._malloc(data.length);
    PDFDoc.module.HEAPU8.set(data, buf);
    this.#pdfium.openFile(buf, data.length);
    // PDFium needs to own these bytes, do don't free them
    //PDFDoc.module._free(buf);
  }
  public pageCount(): number {
    return this.#pdfium.getPageCount();
  }
  public pageSize(pageno: number): Size {
    return new Size(this.#pdfium.getPageWidth(pageno),
                    this.#pdfium.getPageHeight(pageno));
  }
  public generateContent(pageno: number): void {
    this.#pdfium.generagePageContent(pageno);
  }
  // If `filename` is empty, open in a new browser window.
  public saveDocument(filename: string): void {
    const fileSaver = PDFDoc.module.SaveDoc();
    const blob = new Blob([fileSaver.getData()], {type: 'application/pdf'});
    const data = window.URL.createObjectURL(blob);
    fileSaver.delete();
    if (filename === "") {
      window.open(data);
    } else {
      var link = document.createElement('a');
      link.href = data;
      link.download = filename;
      link.click();
    }
    setTimeout(() => { window.URL.revokeObjectURL(data); }, 100);
  }
  // if `width` is <= 0, text is not wrapped. `html` and `width` are saved into the doc to be loaded later
  addTextOverlayToPage(pageno: number, bytes: Uint8Array, rect: Rect, html: string, width: number): void {
    // Copy bytes into the pdfium address space
    const buf: number = PDFDoc.module._malloc(bytes.byteLength);
    PDFDoc.module.HEAPU8.set(bytes, buf);
    this.#pdfium.addTextOverlayToPage(pageno, buf, bytes.byteLength, rect.origin.x, rect.bottom(), html, width);
    PDFDoc.module._free(buf);
  }
  reducePageObjects(pageno: number, finalPageobjCount: number): void {
    this.#pdfium.reducePageObjects(pageno, finalPageobjCount);
  }
  pageCountObjects(pageno: number): number {
    return this.#pdfium.pageCountObjects(pageno);
  }
  public render(pageno: number, pageRect: Rect, outSize: Size, gl: WebGLRenderingContext): Texture {
    const pixWidth = Math.round(outSize.width);
    const pixHeight = Math.round(outSize.height);
    // Render the texture
    let tr = mat3.create();
    mat3.scale(tr, tr, [pixWidth / pageRect.size.width, pixHeight / pageRect.size.height ]);
    mat3.translate(tr, tr, [-pageRect.origin.x, -pageRect.origin.y]);
    // console.log(`Render: ${outSize} page ${pageno} rect: ${pageRect} mat: ${tr}`);
    const bufPtr: number = this.#pdfium.render(pageno, pixWidth, pixHeight,
        tr[0], tr[1], tr[3], tr[4], tr[6], tr[7]);
    if (bufPtr === 0) {
      throw new Error(`Render of page ${pageno} failed`);
    }
    // copy data to the texture and free the data from wasm
    let arr = new Uint8ClampedArray(PDFDoc.module.HEAPU8.buffer,
        bufPtr, pixWidth * pixHeight * 4);
    const ret: Texture = new Texture(gl, arr, new Size(pixWidth, pixHeight), pageRect);
    this.#pdfium.freeBuf(bufPtr);
    return ret;
  }
}