// Copyright...

import DocView from "./docview";
import { GLController } from "./glcontroller";

export default class DocController {
  constructor(view: DocView, glController: GLController) {
    view.onViewportChanged( (fast: boolean) => {
      let gl = glController.glContext();
      if (gl) {
        console.log(`updating gl state: ${fast}`);
        view.updateGLState(glController, fast);
        view.drawGL(glController, glController.colorTrianges);
      }
    });
  }
}