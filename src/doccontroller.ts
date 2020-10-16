// Copyright...

import DocView from "./docview";
import { GLController } from "./glcontroller";

export default class DocController {
  constructor(view: DocView, glController: GLController) {
    view.onViewportChanged( () => {
      let gl = glController.glContext();
      if (gl) {
        view.updateGLState(glController, false);
        view.drawGL(gl, glController.colorTrianges);
      }
    });
  }
}