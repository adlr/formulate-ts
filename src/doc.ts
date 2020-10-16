// Copyright...

import PDFDoc from "./pdfdoc";
import { Rect, Size } from "./geometry";
import { GLController, Texture } from "./glcontroller";
import { mat3 } from "gl-matrix";

interface Overlay {

}

export default class Doc {
  #overlays: Array<Array<Overlay>>;
  #pdfdoc: PDFDoc;
  // Cache page sizes as it's a bit expensive to read them from the PDF
  #pageSizes: Array<Size>;

  constructor(pdfdoc: PDFDoc) {
    this.#overlays = [];
    this.#pdfdoc = pdfdoc;
    this.#pageSizes = [];
    this.updatePageSizes();
  }
  public pageCount(): number {
    return this.#pageSizes.length;
  }
  private updatePageSizes(): void {
    const pages = this.#pdfdoc.pageCount();
    for (let i = 0; i < pages; i++) {
      this.#pageSizes.push(this.#pdfdoc.pageSize(i));
    }
  }
  public pageSize(pageno: number): Size {
    return this.#pageSizes[pageno];
  }

  pageTex: Map<number, Texture> = new Map();

  private expandRenderAreaInPlace(pageno: number, pageRect: Rect, outSize: Size): void {
    const EXPAND_PIXELS = 200;  // Expand up to this many pixels in each direction
    const scale = outSize.width / pageRect.size.width;
    if (Math.abs(scale - (outSize.height / pageRect.size.height)) > 0.001) {
      console.log(`Non-square scale factor found`);
    }
    pageRect.outsetBy(EXPAND_PIXELS / scale);
    pageRect.intersectWithLTRB(0, 0, this.#pageSizes[pageno].width, this.#pageSizes[pageno].height);
    outSize.set(pageRect.size.width * scale, pageRect.size.height * scale);
  }

  // GL state
  // |outSize| is in pixels, |rect| is page coordinates
  updateGLState(glController: GLController, fast: boolean, pageno: number, rect: Rect, outSize: Size): void {
    if (fast)
      return;
    const gl = glController.glContext();
    if (gl === null)
      throw new Error("Unable to get GL context");
    if (outSize.isEmpty()) {
      // delete the texture
      if (this.pageTex.has(pageno)) {
        this.pageTex.get(pageno)!.free(gl);
        this.pageTex.delete(pageno);
        console.log(`deleted texture for page ${pageno}`);
      }
      return;
    }
    if (this.pageTex.has(pageno)) {
      if (this.pageTex.get(pageno)!.contains(rect, outSize))
        return;
      // Need to rerender
      this.pageTex.get(pageno)!.free(gl);
      this.pageTex.delete(pageno);
    }
    // Render the page
    //console.log(`Original render size: ${outSize}`);
    this.expandRenderAreaInPlace(pageno, rect, outSize);
    //console.log(`Expanded render size: ${outSize}`);
    const tex: Texture = new Texture(this.#pdfdoc.render(pageno, rect, outSize, gl), outSize, rect);
    console.log(`saved texture for page ${pageno}`);
    this.pageTex.set(pageno, tex);
  }
  glStateLost(): void {
    this.pageTex.clear();
  }
  // draw the scene. If |transform| is applied to the gl program, then the coordinates
  // passed in should be page coordinates.
  drawGL(glController: GLController, transform: mat3): void {
    
  }
}