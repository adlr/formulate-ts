// Copyright...

import { Size, Rect, Point, Range, NonNull } from "./geometry";
import Doc from "./doc";
import { GLController, GLProgram, Texture } from "./glcontroller";
import { mat3, vec3 } from "gl-matrix";

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
  #scrollContent: HTMLElement;
  #zoom: number;
  #doc: Doc;
  #size: Size;
  #pageLocations: Array<Rect>;
  #visibleSubrect: Rect;
  private viewportChangedCallback: ((boolean) => void) | null = null;

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
    this.#scrollContent = assertDefined(document.querySelector(`#${tagPrefix}-content`));
    this.updateDOM();
    this.#scrollOuter.addEventListener('scroll', (evt) => { this.scrolled(); }, {passive: true});
    window.addEventListener('resize', (evt) => { this.updateDOM(); });

    // Zoom handling
    this.#scrollOuter.addEventListener('pointerdown', (event) => { this.pointerDown(event); })
    this.#scrollOuter.addEventListener('pointermove', (event) => { this.pointerMove(event); })
    this.#scrollOuter.addEventListener('pointerup', (event) => { this.pointerUp(event); })
    this.#scrollOuter.addEventListener('pointercancel', (event) => { this.pointerCancel(event); })
    this.#scrollOuter.addEventListener('pointerout', (event) => { this.pointerUp(event); })
    this.#scrollOuter.addEventListener('pointerleave', (event) => { this.pointerUp(event); })
    this.#scrollOuter.addEventListener('wheel', (event) => { this.onWheel(event); });
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

  // Own setters for scroll left/top. The reason for this is to avoid triggering
  // the scroll event handler when we set these ourselves.
  private scrollLeft: number = -1;
  private scrollTop: number = -1;
  private setScrollLeft(value: number): void {
    this.#scrollOuter.scrollLeft = this.scrollLeft = value;
  }
  private setScrollTop(value: number): void {
    this.#scrollOuter.scrollTop = this.scrollTop = value;
  }

  private updateDOM(): void {
    //const rect = this.#canvas.getBoundingClientRect();
    this.#canvas.width = window.devicePixelRatio * this.#canvas.clientWidth;
    this.#canvas.height = window.devicePixelRatio * this.#canvas.clientHeight;
    this.#scrollInner.style.width = this.#scrollInner.style.minWidth =
      (this.#size.width * this.#zoom) + 'px';
    this.#scrollInner.style.height = (this.#size.height * this.#zoom) + 'px';
    this.#scrollContent.style.width = this.#scrollContent.style.minWidth = this.#size.width + 'px';
    this.#scrollContent.style.height = this.#size.height + 'px';
    this.#scrollContent.style.transform = 'scale(' + this.#zoom + ')';
    this.updateVisibleSubrect();
  }
  // In |fast| condition, it's okay to be a bit ugly.
  updateGLState(glController: GLController, fast: boolean): void {
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
        const outSize = new Size(pageRect.size.width * this.#zoom * window.devicePixelRatio,
                                 pageRect.size.height * this.#zoom * window.devicePixelRatio);
        this.#doc.updateGLState(glController, false, i, pageRect, outSize);
      }
    }
    
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
  }
  glStateLost(): void {
    this.bgVertices = null;
    this.bgPositionPages.set(0, 0);
    this.pageTextures.clear();
  }
  drawGL(glController: GLController, program: GLProgram): void {
    // draw background rectangles
    if (this.bgPositionPages.isEmpty()) {
      console.log('nothing to draw in docview');
      return;
    }
    const gl = NonNull(glController.glContext());
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
    mat3.translate(transform, transform, [-this.#visibleSubrect.origin.x, -this.#visibleSubrect.origin.y]);
    gl.uniformMatrix3fv(program.getULocation('transform'), false, transform);
    gl.drawArrays(gl.TRIANGLES, 0, 12 * this.bgPositionPages.size());

    // Draw each visible page
    for (let i = this.bgPositionPages.start; i < this.bgPositionPages.end; i++) {
      const pageTransform = mat3.create();
      mat3.translate(pageTransform, transform, [this.#pageLocations[i].origin.x,
                                                this.#pageLocations[i].origin.y]);
      this.#doc.drawGL(glController, i, pageTransform);
    }
  }
  // scroll event handler
  private recentScrollTimeout: number | null = null;
  public scrolled(): void {
    if (this.scrollLeft === this.#scrollOuter.scrollLeft &&
        this.scrollTop === this.#scrollOuter.scrollTop) {
      this.scrollTop = this.scrollLeft = -1;
      return;
    }
    if (this.pointerEventHandler === null) {
      if (this.recentScrollTimeout) {
        window.clearTimeout(this.recentScrollTimeout);
      }
      this.recentScrollTimeout = window.setTimeout(() => {
        this.recentScrollTimeout = null;
        this.updateVisibleSubrect();
      }, 50);
    }
    this.updateVisibleSubrect();
  }
  private updateVisibleSubrect(): void {
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
        (this.#scrollOuter.scrollLeft - marginLeft) / this.#zoom,
        (this.#scrollOuter.scrollTop - marginTop) / this.#zoom,
        this.#scrollOuter.clientWidth / this.#zoom,
        this.#scrollOuter.clientHeight / this.#zoom);
    if (this.viewportChangedCallback) {
      this.viewportChangedCallback(this.pointerEventHandler !== null ||
                                   this.recentScrollTimeout !== null);
    }    
  }
  onViewportChanged(callback: (boolean) => void): void {
    this.viewportChangedCallback = callback;
  }
  public handlePinch(prevCX: number, prevCY: number, currCX: number, currCY: number, dz: number): void {
    const oldScrollLeft = this.#scrollOuter.scrollLeft;
    const oldScrollTop = this.#scrollOuter.scrollTop;
    this.#zoom *= dz;
    this.setScrollLeft(dz * (prevCX + oldScrollLeft) - currCX);
    this.setScrollTop( dz * (prevCY + oldScrollTop)  - currCY);
    this.updateDOM();
  }

  private pointerEventHandler: PointerEventHandler | null = null;
  pointerDown(event: PointerEvent) {
    if (this.pointerEventHandler === null) {
      this.pointerEventHandler = new PointerEventHandler(this);
    }
    this.pointerEventHandler.pointerDown(event);
  }
  pointerUp(event: PointerEvent) {
    if (this.pointerEventHandler === null)
      return;
    const handler = this.pointerEventHandler;
    handler.pointerUp(event);
    if (handler.empty()) {
      this.pointerEventHandler = null;
    }
    this.updateVisibleSubrect();
  }
  pointerCancel(event: PointerEvent) {
    if (this.pointerEventHandler === null)
      return;
    this.pointerEventHandler.pointerCancel(event);
  }
  pointerMove(event: PointerEvent) {
    if (this.pointerEventHandler === null)
      return;
    this.pointerEventHandler.pointerMove(event);
  }

  onWheel(event: WheelEvent) {
    if (event.ctrlKey) {
      console.log(`zoom`);
      event.preventDefault();
    }
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

// This class is created when the first finger touches and deleted
// after the last finger lifts off. It handles the gesture recognition
// for scrolling/zooming.
class PointerEventHandler {
  // Store current ([0]) and previous ([1]) positions per finger
  private pointerEventCache: Map<number, Array<Point>> = new Map;
  private pointerMoveRafRequested: boolean = false;
  private docView: DocView;

  constructor(docView: DocView) {
    this.docView = docView;
  }
  empty(): boolean {
    if (this.pointerMoveRafRequested && this.pointerEventCache.size === 0)
      console.log(`Warning: might delete PointerEventHandler with outstanding RAF`);
    return this.pointerEventCache.size === 0;
  }
  private pointersMoved() {
    this.pointerMoveRafRequested = false;
    // Do moves
    if (this.pointerEventCache.size !== 2)
      return;
    let ids: Array<number> = [];
    for (const item of this.pointerEventCache) {
      ids.push(item[0]);
    }
    let prevX1 = this.pointerEventCache.get(ids[1])![1].x;
    let prevX0 = this.pointerEventCache.get(ids[0])![1].x;
    let prevY1 = this.pointerEventCache.get(ids[1])![1].y;
    let prevY0 = this.pointerEventCache.get(ids[0])![1].y;
    if (prevX0 < 0 || prevX1 < 0)
      return;
    let prevCX: number = (prevX0 + prevX1) / 2;
    let prevCY: number = (prevY0 + prevY1) / 2;
    let currCX: number = (this.pointerEventCache.get(ids[0])![0].x + this.pointerEventCache.get(ids[1])![0].x) / 2;
    let currCY: number = (this.pointerEventCache.get(ids[0])![0].y + this.pointerEventCache.get(ids[1])![0].y) / 2;
    //'dz = sqrt(cdsq / pdsq)'
    let prevDistSq: number = this.pointerEventCache.get(ids[0])![1].distSq(this.pointerEventCache.get(ids[1])![1]);
    let currDistSq: number = this.pointerEventCache.get(ids[0])![0].distSq(this.pointerEventCache.get(ids[1])![0]);
    let dz = Math.sqrt(currDistSq / prevDistSq);
    // Apply to the view
    this.docView.handlePinch(prevCX, prevCY, currCX, currCY, dz);
  }

  // Raw callbacks:
  pointerDown(event: PointerEvent) {
    this.pointerEventCache.set(event.pointerId, [new Point(event.clientX, event.clientY), new Point(-1, -1)]);
  }
  pointerMove(event: PointerEvent) {
    if (!this.pointerEventCache.has(event.pointerId)) {
      return;
    }
    if (this.pointerEventCache.size !== 2)
      return;
    const history: Array<Point> = this.pointerEventCache.get(event.pointerId)!;
    history[1].setFromPoint(history[0]);
    history[0].set(event.clientX, event.clientY);
    if (!this.pointerMoveRafRequested) {
      requestAnimationFrame(() => { this.pointersMoved(); });
      this.pointerMoveRafRequested = true;
    }
  }
  pointerUp(event: PointerEvent) {
    this.pointerEventCache.delete(event.pointerId);
  }
  pointerCancel(event: PointerEvent) {

  }
}