// Copyright...

import DocView from "./docview";
import DrawContext from "./drawcontext";
import { Size, Rect } from "./geometry";

class Texture {
  readonly pageRect: Rect;
  readonly texSize: Size;
  readonly tex: WebGLTexture;
  constructor(pageRect: Rect, texSize: Size, tex: WebGLTexture) {
    this.pageRect = Rect.FromRect(pageRect);
    this.texSize = Size.FromSize(texSize);
    this.tex = tex;
  }
}

// This class owns the WebGL context

export default class TexCache {
  //readonly #canvas: HTMLCanvasElement;
  readonly #textures: Map<number, Texture>;
  #validContext: boolean = false;
  readonly #gl: WebGLRenderingContext;

  constructor(canvas: HTMLCanvasElement) {
    //this.#canvas = canvas;
    let gl = canvas.getContext('webgl');
    if (gl === null) {
      throw new Error('unable to get webgl context');
    }
    this.#gl = gl;
    canvas.addEventListener('webglcontextlost', (event) => { this.handleContextLost(event); }, false);
    canvas.addEventListener('webglcontextrestored', (event) => { this.handleContextRestored(event); }, false);
    this.#textures = new Map<number, Texture>();
    this.initContext();
  }

  // handle context creation/purge
  handleContextLost(event): void {
    event.preventDefault();
    this.#validContext = false;
    this.#textures.clear();
  }
  handleContextRestored(event): void {
    this.initContext();
  }
  initContext(): void {
    this.#validContext = true;
    this.#gl.clearColor(1, 0, 0, 1);
  }

  hasTexForPage(pageno: number, pageRect: Rect, displaySize: Size): boolean {
    return false;
  }
  insertTex(pageno: number, pageRect: Rect, displaySize: Size, buf: Uint8Array) {
    let tex = this.#gl.createTexture();
    if (tex === null)
      throw new Error('unable to allocate GL texture');
    this.#gl.bindTexture(this.#gl.TEXTURE_2D, tex);

    this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_WRAP_S, this.#gl.CLAMP_TO_EDGE);
    this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_WRAP_T, this.#gl.CLAMP_TO_EDGE);
    this.#gl.texParameteri(this.#gl.TEXTURE_2D, this.#gl.TEXTURE_MIN_FILTER, this.#gl.LINEAR);
    this.#gl.texImage2D(this.#gl.TEXTURE_2D, 0, this.#gl.RGBA,
        displaySize.width, displaySize.height, 0,
        this.#gl.RGBA, this.#gl.UNSIGNED_BYTE, buf);
    this.#textures.set(pageno, new Texture(pageRect, displaySize, tex));
  }

  // Handle drawing
  redraw(docView: DocView): void {
    //let context = new DrawContext(this.#gl);
  }
}