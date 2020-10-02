// Copyright...

function assertDefined<T>(input : T | null): T {
  if (input === null || input === undefined) {
    throw new Error('Got null value unexpectedly.');
  }
  return input
}

export default class DocView {
  #canvas: HTMLCanvasElement;
  #scrollOuter: HTMLElement;
  #scrollInner: HTMLElement;

  constructor(tagPrefix: string) {
    this.#canvas = assertDefined(document.querySelector(`#${tagPrefix}-canvas`));
    this.#scrollOuter = assertDefined(document.querySelector(`#${tagPrefix}-scroll-outer`));
    this.#scrollInner = assertDefined(document.querySelector(`#${tagPrefix}-scroll-inner`));
    this.updateSizes();
    this.#scrollOuter.addEventListener('scroll', (evt) => { this.scrolled(); }, {passive: true});
    window.addEventListener('resize', (evt) => { this.updateSizes(); });
  }
  private updateSizes(): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#canvas.width = window.devicePixelRatio * rect.width;
    this.#canvas.height = window.devicePixelRatio * rect.height;
    console.log(`set canvas size to ${this.#canvas.width} x ${this.#canvas.height}`);
  }
  private draw(): void {

  }
  private scrolled(): void {
    let marginLeft = 0;
    let marginTop = 0;
    if (this.#scrollOuter.scrollLeft == 0 ||
        this.#scrollOuter.scrollTop == 0) {
      const style = getComputedStyle(this.#scrollInner);
      marginLeft = parseFloat(style.marginLeft);
      marginTop = parseFloat(style.marginTop);
    }
    console.log(`${this.#scrollOuter.scrollLeft - marginLeft} ${this.#scrollOuter.scrollTop - marginTop}`);

  }
}