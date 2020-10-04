// Copyright...

import PDFDoc from "./pdfdoc";
import { Size } from "./geometry";

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
  public renderPage(ctx, pageno: number) {
    if (pageno in this.#overlays) {
      
    }
  }
}