// Copyright...

import { mat3 } from "gl-matrix";
import { Rect, Size } from "./geometry";

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
  public render(pageno: number, pageRect: Rect, outSize: Size, gl: WebGLRenderingContext): WebGLTexture {
    const tex = gl.createTexture();
    if (tex === null)
      throw new Error("Unable to allocate GL texture");
    
    // Render the texture
    let tr = mat3.create();
    mat3.scale(tr, tr, [pageRect.size.width / outSize.width, pageRect.size.height / outSize.height]);
    mat3.translate(tr, tr, [pageRect.origin.x, pageRect.origin.y]);
    //console.log(`Render: ${outSize} page ${pageno} mat: ${tr}`);
    const bufPtr: number = this.#pdfium.render(pageno, outSize.width, outSize.height,
        tr[0], tr[1], tr[3], tr[4], tr[6], tr[7]);
    if (bufPtr === 0) {
      gl.deleteTexture(tex);
      throw new Error(`Render of page ${pageno} failed`);
    }
    // copy data to the texture and free the data from wasm
    let arr = new Uint8ClampedArray(PDFDoc.module.HEAPU8.buffer,
        bufPtr, outSize.width * outSize.height * 4);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    //   new Uint8Array([0, 0, 255, 255]));

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, outSize.width, outSize.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, arr);
    this.#pdfium.freeBuf(bufPtr);
    return tex;
  }
}