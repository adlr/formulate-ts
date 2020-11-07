// Copyright...

import { mat3 } from "gl-matrix";
import { NonNull, Point, Rect } from "./geometry";
import { GLController } from "./glcontroller";
import { Overlay } from "./overlay";
import { CreateRichEditor, RichEditor } from "./richeditor";

export interface TextOverlayDelegate {
  // Remove div from the DOM tree
  removeDiv: (div: HTMLDivElement) => void;

  // Place div into the DOM tree with the given coordinates
  placeDiv: (overlay: TextOverlay, div: HTMLDivElement, absolutePositionRect: Rect) => void;
}

export class TextOverlay implements Overlay {
  readonly bounds: Rect = new Rect();
  private fixedWidth: boolean = true;
  private readonly delegate: TextOverlayDelegate;
  // If non-null, the div housing the live editor
  private editingDiv: HTMLDivElement | null = null;
  private richEditor: RichEditor | null = null;
  // The users's text:
  private htmlText: string = '';
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
    console.log(`text area place end rect: ${this.bounds}`);
    // Create div
    this.editingDiv = document.createElement('div');
    this.editingDiv.style.border = '1px solid #000';
    this.editingDiv.style.width = '1000px';
    this.delegate.placeDiv(this, this.editingDiv, this.bounds);
    this.richEditor = CreateRichEditor(this.editingDiv,
                                       this.fixedWidth ? this.bounds.size.width : -1,
                                       this.htmlText);
  }
  stopEditing() {
    NonNull(this.editingDiv).remove();
    this.richEditor = null;
  }

  // Drawing
  updateGLState(glController: GLController, fast: boolean): void {
  }
  glStateLost(): void {
  }
  drawGL(glController: GLController, transform: mat3): void {
  }

}
