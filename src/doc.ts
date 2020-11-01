// Copyright...

import PDFDoc from "./pdfdoc";
import { Rect, Size } from "./geometry";
import { GLController, Texture } from "./glcontroller";
import { mat3 } from "gl-matrix";
import { Overlay } from "./overlay";

class PageGLState {
  tex: Texture;
  positionBuf: WebGLBuffer;
  texCoordBuf: WebGLBuffer;
  constructor(tex: Texture, positionBuf: WebGLBuffer, texCoordBuf: WebGLBuffer) {
    this.tex = tex;
    this.positionBuf = positionBuf;
    this.texCoordBuf = texCoordBuf;
  }
  free(gl: WebGLRenderingContext): void {
    this.tex.free(gl);
    gl.deleteBuffer(this.positionBuf);
    gl.deleteBuffer(this.texCoordBuf);
  }
}

export default class Doc {
  private readonly overlays: Map<number, Array<Overlay>> = new Map();
  #pdfdoc: PDFDoc;

  constructor(pdfdoc: PDFDoc) {
    this.#pdfdoc = pdfdoc;
  }
  public pageCount(): number {
    return this.#pdfdoc.pageCount();
  }
  public pageSize(pageno: number): Size {
    return this.#pdfdoc.pageSize(pageno);
  }

  public addOverlay(pageno: number, overlay: Overlay): void {
    if (!this.overlays.has(pageno)) {
      this.overlays.set(pageno, []);
    }
    this.overlays.get(pageno)!.push(overlay);
  }

  pageGLState: Map<number, PageGLState> = new Map();

  private expandRenderAreaInPlace(pageno: number, pageRect: Rect, outSize: Size): void {
    const EXPAND_PIXELS = 200;  // Expand up to this many pixels in each direction
    const scale = outSize.width / pageRect.size.width;
    if (Math.abs(scale - (outSize.height / pageRect.size.height)) > 0.001) {
      console.log(`Non-square scale factor found`);
    }
    pageRect.outsetBy(EXPAND_PIXELS / scale);
    const pageSize = this.pageSize(pageno);
    pageRect.intersectWithLTRB(0, 0, pageSize.width, pageSize.height);
    outSize.set(pageRect.size.width * scale, pageRect.size.height * scale);
  }

  // GL state
  // |outSize| is in pixels, |rect| is page coordinates
  updateGLState(glController: GLController, fast: boolean, pageno: number, rect: Rect, outSize: Size): void {
    this.updatePDFPageGLState(glController, fast, pageno, rect, outSize);
    if (this.overlays.has(pageno)) {
      const arr = this.overlays.get(pageno)!;
      for (let i = 0; i < arr.length; i++) {
        arr[i].updateGLState(glController, fast);
      }
    }
  }
  // GL state
  // |outSize| is in pixels, |rect| is page coordinates
  updatePDFPageGLState(glController: GLController, fast: boolean, pageno: number, rect: Rect, outSize: Size): void {
    if (fast)
      return;
    const gl = glController.glContext();
    if (gl === null)
      throw new Error("Unable to get GL context");
    if (outSize.isEmpty()) {
      // delete the texture
      if (this.pageGLState.has(pageno)) {
        this.pageGLState.get(pageno)!.free(gl);
        this.pageGLState.delete(pageno);
      }
      return;
    }
    if (this.pageGLState.has(pageno)) {
      if (this.pageGLState.get(pageno)!.tex.contains(rect, outSize)) {
        return;
      }
      // Need to rerender
      this.pageGLState.get(pageno)!.free(gl);
      this.pageGLState.delete(pageno);
    }
    // Render the page
    //console.log(`Original render size: ${outSize}`);
    this.expandRenderAreaInPlace(pageno, rect, outSize);
    //console.log(`Expanded render size: ${outSize}`);
    const tex: Texture = new Texture(this.#pdfdoc.render(pageno, rect, outSize, gl), outSize, rect);
    // Set up coordinate bufs
    const posBuf = gl.createBuffer();
    const texCoordBuf = gl.createBuffer();
    if (posBuf === null || texCoordBuf === null) {
      tex.free(gl);
      console.log(`Unable to allocate GL Buffer`);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      rect.left(), rect.top(),
      rect.left(), rect.bottom(),
      rect.right(), rect.top(),
      rect.left(), rect.bottom(),
      rect.right(), rect.top(),
      rect.right(), rect.bottom(),
    ]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      0, 1,
      1, 0,
      0, 1,
      1, 0,
      1, 1,
    ]), gl.STATIC_DRAW);

    this.pageGLState.set(pageno, new PageGLState(tex, posBuf, texCoordBuf));
  }
  glStateLost(): void {
    this.pageGLState.clear();
    this.overlays.forEach((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i].glStateLost();
      }
    });
  }
  // draw the scene. If |transform| is applied to the gl program, then the coordinates
  // passed in should be page coordinates.
  drawGL(glController: GLController, pageno: number, transform: mat3): void {
    if (!this.pageGLState.has(pageno))
      return;
    const state = this.pageGLState.get(pageno)!;
    const gl = glController.glContext();
    if (gl === null) {
      console.log(`Have null GL render context`);
      return;
    }
    gl.useProgram(glController.drawTex.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuf);
    gl.enableVertexAttribArray(glController.drawTex.getAttrLocation('position'));
    gl.vertexAttribPointer(
      glController.drawTex.getAttrLocation('position'), // location
      2,                  // size (components per iteration)
      gl.FLOAT,           // type
      false,              // normalize
      0,                  // stride
      0,                  // offset
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, state.texCoordBuf);
    gl.enableVertexAttribArray(glController.drawTex.getAttrLocation('texcoord'));
    gl.vertexAttribPointer(
      glController.drawTex.getAttrLocation('texcoord'), // location
      2,                  // size (components per iteration)
      gl.FLOAT,           // type
      false,              // normalize
      0,                  // stride
      0,                  // offset
    );
    gl.bindTexture(gl.TEXTURE_2D, state.tex.tex);
    gl.uniform1i(glController.drawTex.getULocation('u_texture'), 0);
    gl.uniformMatrix3fv(glController.drawTex.getULocation('transform'), false, transform);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Draw overlays
    if (this.overlays.has(pageno)) {
      const arr = this.overlays.get(pageno)!;
      for (let i = 0; i < arr.length; i++) {
        arr[i].drawGL(glController, transform);
      }
    }
  }
}