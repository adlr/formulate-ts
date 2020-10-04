// Copyright...

import { Size, Rect, Point } from "./geometry";
import Doc from "./doc";

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
      this.draw();
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
    this.draw();
  }
  private updateDOM(): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#canvas.width = window.devicePixelRatio * rect.width;
    this.#canvas.height = window.devicePixelRatio * rect.height;
    console.log(`set canvas size to ${this.#canvas.width} x ${this.#canvas.height}`);
    this.#scrollInner.style.width = this.#scrollInner.style.minWidth =
      (this.#size.width * this.#zoom) + 'px';
    this.#scrollInner.style.height = (this.#size.height * this.#zoom) + 'px'
  }
  private draw(gl: WebGLRenderingContext | null = null): void {
    // scissor + viewport to just this view
    for (let i = 0; i < this.#pageLocations.length; i++) {
      if (!this.#visibleSubrect.intersects(this.#pageLocations[i]))
        continue;
      // draw page outline
      // draw page
    }
  }
  // scroll event handler
  private scrolled(): void {
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
    this.draw();
  }
}