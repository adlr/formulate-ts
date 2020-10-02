// Copyright...

interface Overlay {

}

class Doc {
  constructor() {
    this.#overlays = [];
  }
  public renderPage(ctx, pageno: number) {
    if (pageno in this.#overlays) {
      
    }
  }

  #overlays: Array<Array<Overlay>>;
}