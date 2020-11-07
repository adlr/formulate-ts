// Copyright...

import { mat3 } from "gl-matrix";
import { NonNull, Point, Rect } from "./geometry";
import { GLController } from "./glcontroller";
import { Overlay } from "./overlay";
import { CreateRichEditor } from "./richeditor";

export interface TextOverlayDelegate {
  // Remove div from the DOM tree
  removeDiv: (div: HTMLDivElement) => void;

  // Place div into the DOM tree with the given coordinates
  placeDiv: (overlay: TextOverlay, div: HTMLDivElement, absolutePositionRect: Rect) => void;
}

export class TextOverlay implements Overlay {
  readonly bounds: Rect = new Rect();
  private readonly delegate: TextOverlayDelegate;
  // If non-null, the div housing the live editor
  private editingDiv: HTMLDivElement | null = null;
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
    console.log(`text area place end rect: ${this.bounds}`);
    // Create div
    this.editingDiv = document.createElement('div');
    this.editingDiv.innerHTML = this.htmlText;
    this.editingDiv.style.border = '1px solid #000';
    this.delegate.placeDiv(this, this.editingDiv, this.bounds);
    let richEditor = CreateRichEditor(this.editingDiv);
  }

  // Drawing
  updateGLState(glController: GLController, fast: boolean): void {
  }
  glStateLost(): void {
  }
  drawGL(glController: GLController, transform: mat3): void {
  }

}
