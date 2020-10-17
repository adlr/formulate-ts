// Copyright...

import DocView from "./docview";
import { GLController } from "./glcontroller";

export default class DocController {
  constructor(view: DocView, glController: GLController) {
    view.onViewportChanged( (fast: boolean) => {
      let gl = glController.glContext();
      if (gl) {
        view.updateGLState(glController, fast);
        view.drawGL(glController, glController.colorTrianges);
      }
    });
  }
}