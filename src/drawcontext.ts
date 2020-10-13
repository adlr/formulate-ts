// Copyright...

import { Color, Rect } from "./geometry";
import { mat3, vec2 } from "gl-matrix";

export default class DrawContext {
  #gl: WebGLRenderingContext;
  readonly #trianglesToDraw: Array<number> = [];
  readonly #vertexColors: Array<number> = [];
  readonly #transformStack: Array<mat3> = [];

  constructor(gl: WebGLRenderingContext) {
    this.#gl = gl;
    this.#transformStack.push(mat3.create());

    // set up programs, should happen in texcache

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    // default transform maps to the standard webgl clip space
    this.scaleXY(2 / gl.canvas.width, -2 / gl.canvas.height);
    this.translate(-1, 1);
  }
  private drawRemainingTriangles(): void {
    // TODO: use triangle program
    let program: WebGLProgram;

    let positionBuffer = this.#gl.createBuffer();
    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, positionBuffer);
    this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(this.#trianglesToDraw), this.#gl.STATIC_DRAW);
    let positionLocation = this.#gl.getAttribLocation(program, 'a_position');

    let colorBuffer = this.#gl.createBuffer();
    this.#gl.bindBuffer(this.#gl.ARRAY_BUFFER, colorBuffer);
    this.#gl.bufferData(this.#gl.ARRAY_BUFFER, new Float32Array(this.#trianglesToDraw), this.#gl.STATIC_DRAW);
    let colorLocation = this.#gl.getAttribLocation(program, 'a_color');

    this.#gl.enableVertexAttribArray(positionLocation);
    this.#gl.clear(this.#gl.COLOR_BUFFER_BIT);

    this.#gl.vertexAttribPointer(positionLocation, 2, this.#gl.FLOAT, false, 0, 0);
    this.#gl.vertexAttribPointer(colorLocation, 4, this.#gl.FLOAT, false, 0, 0);
    this.#gl.drawArrays(this.#gl.TRIANGLES, 0, this.#trianglesToDraw.length / 2);
    this.#gl.deleteBuffer(positionBuffer);
    this.#gl.deleteBuffer(colorBuffer);
    this.#trianglesToDraw.length = 0;
    this.#vertexColors.length = 0;
  }
  finish(): void {
    this.drawRemainingTriangles();
  }
  save(): void {
    this.#transformStack.push(mat3.create());
    mat3.copy(this.#transformStack[this.#transformStack.length - 1],
              this.#transformStack[this.#transformStack.length - 2]);
  }
  restore(): void {
    if (this.#transformStack.length < 2)
      throw new Error("restore without save");
    this.#transformStack.pop();
  }
  // return value can be modified to change the current transform in-place
  currentTransform(): mat3 {
    return this.#transformStack[this.#transformStack.length - 1];
  }
  // modify current transform in place
  scale(factor: number): void {
    this.scaleXY(factor, factor);
  }
  scaleXY(x: number, y: number): void {
    mat3.scale(this.currentTransform(), this.currentTransform(), [x, y]);
  }
  translate(x: number, y: number): void {
    mat3.translate(this.currentTransform(), this.currentTransform(), [x, y]);
  }

  drawRect(rect: Rect, fill: Color): void {
    let pushVec2 = (point: vec2) => {
      this.#trianglesToDraw.push.apply(this.#trianglesToDraw,
        vec2.transformMat3(vec2.create(), point, this.currentTransform()));
    }
    pushVec2([rect.left(), rect.top()]);
    pushVec2([rect.right(), rect.top()]);
    pushVec2([rect.left(), rect.bottom()]);
    pushVec2([rect.right(), rect.top()]);
    pushVec2([rect.left(), rect.bottom()]);
    pushVec2([rect.right(), rect.bottom()]);
    for (let i = 0; i < 6; i++) {
      this.#vertexColors.push.apply(this.#vertexColors, fill.rgba);
    }
  }
  drawTexture(idx: number): void {

  }
}
