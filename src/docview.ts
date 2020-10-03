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
  #unzoomedSize: Size;
  #pageLocations: Array<Rect>;

  constructor(tagPrefix: string, doc: Doc) {
    this.#zoom = 1.0;
    this.#unzoomedSize = new Size(BORDER_WIDTH * 2, BORDER_WIDTH * 2);
    this.#pageLocations = [];
    this.#doc = doc;
    this.#canvas = assertDefined(document.querySelector(`#joint-canvas`));
    this.#scrollOuter = assertDefined(document.querySelector(`#${tagPrefix}-scroll-outer`));
    this.#scrollInner = assertDefined(document.querySelector(`#${tagPrefix}-scroll-inner`));
    this.updateSizes();
    this.#scrollOuter.addEventListener('scroll', (evt) => { this.scrolled(); }, {passive: true});
    window.addEventListener('resize', (evt) => { this.updateSizes(); });
  }
  // Call this when number of pages or sizes of pages change. Will reload from the doc
  public pagesChanged(): void {
    // Compute the new size
    const pageCount = this.#doc.pageCount();
    if (pageCount === 0) {
      this.#unzoomedSize.set(BORDER_WIDTH * 2, BORDER_WIDTH * 2);
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
    this.#unzoomedSize.set(maxWidth + BORDER_WIDTH * 2, top);
    this.updateSizes();
    this.draw();
  }
  private updateSizes(): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#canvas.width = window.devicePixelRatio * rect.width;
    this.#canvas.height = window.devicePixelRatio * rect.height;
    console.log(`set canvas size to ${this.#canvas.width} x ${this.#canvas.height}`);
    this.#scrollInner.style.width = this.#scrollInner.style.minWidth =
      (this.#unzoomedSize.width * this.#zoom) + 'px';
    this.#scrollInner.style.height = (this.#unzoomedSize.height * this.#zoom) + 'px'
  }
  private draw(): void {

  }
  // scroll event handler
  private scrolled(): void {
    let marginLeft = 0;
    let marginTop = 0;
    if (this.#scrollOuter.scrollLeft == 0 ||
        this.#scrollOuter.scrollTop == 0) {
      const style = getComputedStyle(this.#scrollInner);
      marginLeft = parseFloat(style.marginLeft);
      marginTop = parseFloat(style.marginTop);
    }
  }
}