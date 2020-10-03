// Copyright...

import PDFDoc from "./pdfdoc";
import { Size } from "./geometry";

interface Overlay {

}

export default class Doc {
  #pdfdoc: PDFDoc;

  constructor(pdfdoc: PDFDoc) {
    this.#overlays = [];
    this.#pdfdoc = pdfdoc;
  }
  public pageCount(): number {
    return this.#pdfdoc.pageCount();
  }
  public pageSize(pageno: number): Size {
    return this.#pdfdoc.pageSize(pageno);
  }
  public renderPage(ctx, pageno: number) {
    if (pageno in this.#overlays) {
      
    }
  }

  #overlays: Array<Array<Overlay>>;
}