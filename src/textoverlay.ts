// Copyright...

import { mat3 } from "gl-matrix";
import { NonNull, Point, Rect } from "./geometry";
import { GLController, Texture } from "./glcontroller";
import { Overlay } from "./overlay";
import { CreateRichEditor, RichEditor } from "./richeditor";
import RichRender from "./richrender";

export interface TextOverlayDelegate {
  // Remove div from the DOM tree
  removeDiv: (div: HTMLDivElement) => void;

  // Place div into the DOM tree with the given (x, y) coordinates
  placeDiv: (overlay: TextOverlay, div: HTMLDivElement, x: number, y: number) => void;
}

const MAX_WIDTH = 1000;

export class TextOverlay implements Overlay {
  readonly bounds: Rect = new Rect();
  private fixedWidth: boolean = true;
  private readonly delegate: TextOverlayDelegate;
  // If non-null, the div housing the live editor
  private editingDiv: HTMLDivElement | null = null;
  private richEditor: RichEditor | null = null;
  // The users's text, only valid when not editing.
  private htmlText: string = '';
  private renderer: RichRender = new RichRender();
  private texture: Texture | null = null;
  constructor(delegate: TextOverlayDelegate) {
    this.delegate = delegate;
  }

  // Event handlers for creating this Overlay
  placeStart(point: Point): void {
    this.bounds.origin.setFromPoint(point);
  }
  placeMove(point: Point): void {
  }
  placeEnd(point: Point): void {
    this.bounds.expandToIncludePoint(point);
    this.bounds.setBottom(this.bounds.origin.y);
    if (this.bounds.size.width < 2) {
      // If user just clicks to place, set width based on contained text.
      this.bounds.setRight(this.bounds.origin.x);
      this.fixedWidth = false;
    }
  }

  isEditable(): boolean { return true; }
  isEditing(): boolean { return this.richEditor !== null; }
  startEditing() {
    if (this.texture !== null)
      this.texture.free();
    this.texture = null;
    console.log(`text area place end rect: ${this.bounds}`);
    // Create div
    this.editingDiv = document.createElement('div');
    this.editingDiv.style.width = MAX_WIDTH + 'px';
    this.delegate.placeDiv(this, this.editingDiv, this.bounds.origin.x - 1, this.bounds.origin.y - 1);
    this.richEditor = CreateRichEditor(this.editingDiv,
                                       this.fixedWidth ? this.bounds.size.width : -1,
                                       this.htmlText);
  }
  stopEditing() {
    this.htmlText = NonNull(this.richEditor).text();
    NonNull(this.editingDiv).remove();
    this.richEditor = null;
    this.editingDiv = null;
    this.renderer.setText(this.htmlText);
  }

  // Drawing
  updateGLState(gl: WebGLRenderingContext, fast: boolean, zoom: number): void {
    if (this.editingDiv !== null)
      return;  // don't do GL when editing
    if (this.htmlText === "")
      return;
    const needRender = this.renderer.wrap(this.fixedWidth ? this.bounds.size.width : MAX_WIDTH) ||
        (this.texture === null) || (!fast && zoom !== this.renderer.lastRenderedZoom());
    if (needRender && this.texture !== null) {
      this.texture.free();
      console.log(`deleting rendered text`);
      this.texture = null;
    }
    if (this.texture === null) {
      console.log(`rendering text`);
      this.texture = this.renderer.renderToTexture(gl, this.bounds.origin, zoom);
    }
  }
  glStateLost(): void {
    this.texture = null;
  }
  drawGL(glController: GLController, transform: mat3): void {
    if (this.editingDiv !== null || this.htmlText === "")
      return;
    const gl = glController.glContext();
    if (gl === null) {
      console.log(`Have null GL render context`);
      return;
    }
    if (this.texture === null)
      return;
    gl.useProgram(glController.drawTex.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texture.posBuf);
    gl.enableVertexAttribArray(glController.drawTex.getAttrLocation('position'));
    gl.vertexAttribPointer(
      glController.drawTex.getAttrLocation('position'), // location
      2,                  // size (components per iteration)
      gl.FLOAT,           // type
      false,              // normalize
      0,                  // stride
      0,                  // offset
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texture.texCoordBuf);
    gl.enableVertexAttribArray(glController.drawTex.getAttrLocation('texcoord'));
    gl.vertexAttribPointer(
      glController.drawTex.getAttrLocation('texcoord'), // location
      2,                  // size (components per iteration)
      gl.FLOAT,           // type
      false,              // normalize
      0,                  // stride
      0,                  // offset
    );
    gl.bindTexture(gl.TEXTURE_2D, this.texture.tex);
    gl.uniform1i(glController.drawTex.getULocation('u_texture'), 0);
    gl.uniformMatrix3fv(glController.drawTex.getULocation('transform'), false, transform);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

}
