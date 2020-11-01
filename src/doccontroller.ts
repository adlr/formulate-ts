// Copyright...

import { userInfo } from "os";
import { threadId } from "worker_threads";
import Doc from "./doc";
import DocView, { PointerEventHandler } from "./docview";
import { Point } from "./geometry";
import { GLController } from "./glcontroller";
import { CreateOverlay, Overlay, OverlayType } from "./overlay";

export default class DocController {
  private readonly docView: DocView;
  private readonly doc: Doc;
  private readonly glController: GLController;
  constructor(view: DocView, doc: Doc, glController: GLController) {
    this.docView = view;
    this.doc = doc;
    this.glController = glController;
    view.onViewportChanged( (fast: boolean) => {
      this.redraw(fast);
    });
  }
  private tool: OverlayType = OverlayType.NONE;
  toolChanged(type: OverlayType): void {
    this.tool = type;
  }
  handlePointerDown(event: PointerEvent): PointerEventHandler | null {
    if (this.tool === OverlayType.FREEHAND) {
      const newOverlay = CreateOverlay(this.tool);
      return new DocControllerPointerEventHandler(this.docView, this, this.doc, newOverlay);
    }
    return null;
  }
  private redrawRequested: boolean = false;
  private redrawFast: boolean = true;
  redraw(fast: boolean) {
    if (this.redrawRequested) {
      if (this.redrawFast)  // favor slow when many request
        this.redrawFast = fast;
      return;
    }
    this.redrawRequested = true;
    this.redrawFast = fast;
    window.requestAnimationFrame((now: DOMHighResTimeStamp) => {
      this.docView.updateGLState(this.glController, this.redrawFast);
      this.docView.drawGL(this.glController, this.glController.colorTrianges);
      this.redrawRequested = false;
  });
  }
}

// Creates a new overlay
class DocControllerPointerEventHandler implements PointerEventHandler {
  private readonly fingersDown: Set<number> = new Set();
  private useingID: number = 0;
  private readonly docView: DocView;
  private readonly doc: Doc;
  private readonly docController: DocController;
  private overlay: Overlay;
  private pageno: number = -1;
  constructor(docView: DocView, docController: DocController, doc: Doc, overlay: Overlay) {
    this.docView = docView;
    this.docController = docController;
    this.doc = doc;
    this.overlay = overlay;
  }
  pointerDown(event: PointerEvent) {
    this.fingersDown.add(event.pointerId);
    this.useingID = event.pointerId;
    const point = this.docView.pointFromEvent(event);
    this.pageno = this.docView.pageForPoint(point);
    this.docView.convertPointToPageInPlace(this.pageno, point);
    this.doc.addOverlay(this.pageno, this.overlay);
    this.overlay.placeStart(point);
  }
  pointerMove(event: PointerEvent) {
    if (event.pointerId !== this.useingID)
      return;
    const point = this.docView.pointFromEvent(event);
    this.docView.convertPointToPageInPlace(this.pageno, point);
    this.overlay.placeMove(point);
    this.docController.redraw(true);
  }
  pointerUp(event: PointerEvent) {
    const point = this.docView.pointFromEvent(event);
    this.docView.convertPointToPageInPlace(this.pageno, point);
    this.overlay.placeEnd(point);
    this.fingersDown.delete(event.pointerId);
  }
  pointerCancel(event: PointerEvent) {
    this.pointerUp(event);
  }
  empty(): boolean {
    return this.fingersDown.size === 0;
  }
}
