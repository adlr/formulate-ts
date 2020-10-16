// Copyright...

import { Size, Rect, Point, Range } from "./geometry";
import Doc from "./doc";
import { GLController, GLProgram, Texture } from "./glcontroller";
import { mat3 } from "gl-matrix";

function assertDefined<T>(input : T | null): T {
  if (input === null || input === undefined) {
    throw new Error('Got null value unexpectedly.');
  }
  return input
}

const BORDER_WIDTH = 20;

export default class DocView {
  #canvas: HTMLCanvasElement;
  #scrollOuter: HTMLElement;
  #scrollInner: HTMLElement;
  #zoom: number;
  #doc: Doc;
  #size: Size;
  #pageLocations: Array<Rect>;
  #visibleSubrect: Rect;
  private viewportChangedCallback: (() => void) | null = null;

  // GL state:
  private bgVertices: WebGLBuffer | null = null;
  private bgColorBuffer: WebGLBuffer | null = null;
  private readonly bgPositionPages: Range = new Range(0, 0);
  private readonly pageTextures: Map<number, Texture> = new Map();  // page->texture

  constructor(tagPrefix: string, doc: Doc) {
    this.#zoom = 1.0;
    this.#size = new Size(BORDER_WIDTH * 2, BORDER_WIDTH * 2);
    this.#visibleSubrect = Rect.FromSize(this.#size);
    this.#pageLocations = [];
    this.#doc = doc;
    this.#canvas = assertDefined(document.querySelector(`#joint-canvas`));
    this.#scrollOuter = assertDefined(document.querySelector(`#${tagPrefix}-scroll-outer`));
    this.#scrollInner = assertDefined(document.querySelector(`#${tagPrefix}-scroll-inner`));
    this.updateDOM();
    this.#scrollOuter.addEventListener('scroll', (evt) => { this.scrolled(); }, {passive: true});
    window.addEventListener('resize', (evt) => { this.updateDOM(); });
  }
  // Call this when number of pages or sizes of pages change. Will reload from the doc
  public pagesChanged(): void {
    // Compute the new size
    const pageCount = this.#doc.pageCount();
    if (pageCount === 0) {
      this.#size.set(BORDER_WIDTH * 2, BORDER_WIDTH * 2);
      return;
    }
    let maxWidth = 0;
    let top = BORDER_WIDTH;
    // first, insert pages left aligned, then circle back and center them
    for (let i = 0; i < pageCount; i++) {
      const pageSize = this.#doc.pageSize(i);
      maxWidth = Math.max(maxWidth, pageSize.width);
      const pageRect = Rect.FromSizeOrigin(pageSize, new Point(0, top));
      top += BORDER_WIDTH + pageSize.height;
      this.#pageLocations.push(pageRect);
    }
    const center = maxWidth / 2 + BORDER_WIDTH;
    for (let i = 0; i < pageCount; i++) {
      this.#pageLocations[i].origin.x = center - this.#pageLocations[i].size.width / 2;
    }
    this.#size.set(maxWidth + BORDER_WIDTH * 2, top);
    this.updateDOM();
  }
  private updateDOM(): void {
    //const rect = this.#canvas.getBoundingClientRect();
    this.#canvas.width = window.devicePixelRatio * this.#canvas.clientWidth;
    this.#canvas.height = window.devicePixelRatio * this.#canvas.clientHeight;
    console.log(`set canvas size to ${this.#canvas.width} x ${this.#canvas.height}`);
    this.#scrollInner.style.width = this.#scrollInner.style.minWidth =
      (this.#size.width * this.#zoom) + 'px';
    this.#scrollInner.style.height = (this.#size.height * this.#zoom) + 'px'
  }
  // In |fast| condition, it's okay to be a bit ugly.
  updateGLState(glController: GLController, fast: boolean): void {
    // TODO: scissor + viewport to just this view

    const gl = glController.glContext();
    if (gl === null) {
      console.log(`Unable to get valid GL render context`);
      return;
    }

    let pages = new Range(Number.MAX_SAFE_INTEGER, 0);
    for (let i = 0; i < this.#pageLocations.length; i++) {
      if (!this.#visibleSubrect.intersects(this.#pageLocations[i]))
        continue;
      pages.start = Math.min(pages.start, i);
      pages.end = Math.max(pages.end, i + 1);
    }

    // update the background borders
    if (!pages.equals(this.bgPositionPages)) {
      this.setGLBGBorders(gl, pages);
    }

    // If we're not being fast, update textures
    if (!fast) {
      const start = Math.min(pages.start, this.bgPositionPages.start);
      const end = Math.max(pages.end, this.bgPositionPages.end);
      for (let i = start; i < end; i++) {
        const pageRect = this.#visibleSubrect.intersect(this.#pageLocations[i]);
        this.convertRectToPageInPlace(i, pageRect);
        const outSize = new Size(pageRect.size.width * this.#zoom, pageRect.size.height * this.#zoom);
        this.#doc.updateGLState(glController, false, i, pageRect, outSize);
      }
    }
    
    // Update textures, possibly rerendering
    this.bgPositionPages.set(pages.start, pages.end);
  }
  private setGLBGBorders(gl: WebGLRenderingContext, pages: Range): void {
    if (this.bgVertices) {
      gl.deleteBuffer(this.bgVertices);
    }
    this.bgVertices = gl.createBuffer();
    if (!this.bgVertices) {
      throw new Error("Can't allocate webgl buffer");
    }
    if (this.bgColorBuffer) {
      gl.deleteBuffer(this.bgColorBuffer);
    }
    this.bgColorBuffer = gl.createBuffer();
    if (!this.bgColorBuffer) {
      throw new Error("Can't allocate webgl buffer");
    }

    let vertices: Array<number> = [];  // n * x, y - Float32
    let vertexColors: Array<number> = [];  // n * r, g, b, a - UInt8
    const BORDER_SIZE = 1;  // black border
    for (let i = pages.start; i < pages.end; i++) {
      console.log(`setting borders for page ${i}`)
      const rect = this.#pageLocations[i];
      const outer = Rect.FromRect(rect);
      outer.outsetBy(1);
      // first a big black rectangle for the page
      vertices.push(outer.left(), outer.top(), outer.left(), outer.bottom(), outer.right(), outer.top());
      vertices.push(outer.left(), outer.bottom(), outer.right(), outer.top(), outer.right(), outer.bottom());
      vertexColors.push(...Array(6).fill([0, 0, 0, 255]).flat());
      // then a white one inside it
      vertices.push(rect.left(), rect.top(), rect.left(), rect.bottom(), rect.right(), rect.top());
      vertices.push(rect.left(), rect.bottom(), rect.right(), rect.top(), rect.right(), rect.bottom());
      vertexColors.push(...Array(6).fill([255, 255, 255, 128]).flat());
    }
    // Load data into GL
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgVertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(vertexColors), gl.STATIC_DRAW);
    //console.log(vertices);
  }
  glStateLost(): void {
    this.bgVertices = null;
    this.bgPositionPages.set(0, 0);
    this.pageTextures.clear();
  }
  drawGL(gl: WebGLRenderingContext, program: GLProgram): void {
    // draw background rectangles
    if (this.bgPositionPages.isEmpty()) {
      console.log('nothing to draw in docview');
      return;
    }
    const outerRect = this.#scrollOuter.getBoundingClientRect();
    const dpi = window.devicePixelRatio || 1;
    gl.viewport(outerRect.left * dpi, 0,
                outerRect.width * dpi, outerRect.height * dpi);
    gl.useProgram(program.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgVertices);
    gl.enableVertexAttribArray(program.getAttrLocation('position'));
    gl.vertexAttribPointer(
      program.getAttrLocation('position'), // location
      2,                  // size (components per iteration)
      gl.FLOAT,           // type
      false,              // normalize
      0,                  // stride
      0,                  // offset
      );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgColorBuffer);
    gl.enableVertexAttribArray(program.getAttrLocation('color'));
    gl.vertexAttribPointer(
      program.getAttrLocation('color'), // location
      4,                  // size (components per iteration)
      gl.UNSIGNED_BYTE,  // type
      true,              // normalize
      0,                  // stride
      0,                  // offset
      );
    const transform: mat3 = mat3.create();
    mat3.translate(transform, transform, [-1, 1]);
    mat3.scale(transform, transform, [2 / this.#visibleSubrect.size.width,
                                     -2 / this.#visibleSubrect.size.height]);
    // const goodTransform = [2 / this.#visibleSubrect.size.width, 0, 0,
    //   0, -2 / this.#visibleSubrect.size.height, 0,
    //   -1, 1, 1];
    //   console.log(goodTransform);
    mat3.translate(transform, transform, [-this.#visibleSubrect.origin.x, -this.#visibleSubrect.origin.y]);
    gl.uniformMatrix3fv(program.getULocation('transform'), false, transform);
    gl.drawArrays(gl.TRIANGLES, 0, 12 * this.bgPositionPages.size());

    // Draw each visible page
  }
  // scroll event handler
  public scrolled(): void {
    // Adjust margins of scrollInner to keep it centered
    let marginLeft = 0;
    let marginTop = 0;
    if (this.#scrollOuter.scrollLeft === 0 ||
        this.#scrollOuter.scrollTop === 0) {
      const style = getComputedStyle(this.#scrollInner);
      marginLeft = parseFloat(style.marginLeft);
      marginTop = parseFloat(style.marginTop);
    }

    // see which subrect of inner is visible
    this.#visibleSubrect.set(
        this.#scrollOuter.scrollLeft,
        this.#scrollOuter.scrollTop,
        Math.min(this.#scrollOuter.clientWidth, this.#scrollInner.clientWidth),
        Math.min(this.#scrollOuter.clientHeight, this.#scrollInner.clientHeight));
    if (this.viewportChangedCallback)
      this.viewportChangedCallback();
  }
  onViewportChanged(callback: () => void): void {
    this.viewportChangedCallback = callback;
  }

  // Coordinate conversion
  convertRectFromPageInPlace(pageno: number, rect: Rect): void {
    rect.origin.x += this.#pageLocations[pageno].origin.x;
    rect.origin.y += this.#pageLocations[pageno].origin.y;
  }
  convertRectToPageInPlace(pageno: number, rect: Rect): void {
    rect.origin.x -= this.#pageLocations[pageno].origin.x;
    rect.origin.y -= this.#pageLocations[pageno].origin.y;
  }
}