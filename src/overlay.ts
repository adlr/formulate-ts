// Copyright...

import { mat3 } from "gl-matrix";
import { NonNull, Point, Rect } from "./geometry";
import { GLController, GLProgram } from "./glcontroller";
import { TextOverlay, TextOverlayDelegate } from "./textoverlay";

export interface Overlay {
  bounds: Rect;

  // placing onto the page
  placeStart: (point: Point) => void;
  placeMove: (point: Point) => void;
  placeEnd: (point: Point) => void;

  isEditable: () => boolean;
  isEditing: () => boolean;
  startEditing: () => void;
  stopEditing: () => void;

  // drawing
  updateGLState: (gl: WebGLRenderingContext, fast: boolean, zoom: number) => void;
  glStateLost: () => void;
  drawGL: (glController: GLController, transform: mat3) => void;
}

export enum OverlayType {
  NONE = 0,
  TEXT,
  FREEHAND,
}

export function CreateOverlay(type: OverlayType, textDelegate: TextOverlayDelegate): Overlay {
  if (type === OverlayType.TEXT) {
    console.log(`returning a text overlay`);
    return new TextOverlay(textDelegate);
  }
  return new PenOverlay();
}

class PenOverlay implements Overlay {
  readonly bounds: Rect = new Rect();
  private readonly points: Array<Point> = [];
  placeStart(point: Point): void {
    this.bounds.set(point.x, point.y, 0, 0);
    this.points.push(point);
  }
  placeMove(point: Point): void {
    if (point.closeTo(this.points[this.points.length - 1]))
      return;
    this.points.push(point);
    this.bounds.expandToIncludePoint(point);
  }
  placeEnd(): void {
  }

  isEditable(): boolean { return false; }
  isEditing(): boolean { return false; }
  startEditing(): void {}
  stopEditing(): void {}

  // Drawing
  private verticesBuf: WebGLBuffer | null = null;
  private colorsBuf: WebGLBuffer | null = null;
  private pointsInBuf: number = 0;
  updateGLState(gl: WebGLRenderingContext, fast: boolean, zoom: number): void {
    if (this.pointsInBuf === this.points.length) {
      return;
    }
    if (this.verticesBuf === null) {
      this.verticesBuf = NonNull(gl.createBuffer());
    }
    if (this.colorsBuf === null) {
      this.colorsBuf = NonNull(gl.createBuffer());
    }
    const vertArr: Array<number> = [];  // n * x, y - Float32
    const vertColors: Array<number> = [];  // n * r, g, b, a - UInt8
    for (let i = 0; i < this.points.length - 1; i++) {
      const LINE_WIDTH = 1;  // black border
      const start = this.points[i];
      const end = this.points[i + 1];

      let dx = end.x - start.x;
      let dy = end.y - start.y;
      const dist = Math.sqrt(start.distSq(end));
      const scale = (LINE_WIDTH / 2) / dist;
      dx *= scale;
      dy *= scale;
      // four corners of the rectangle are r{abcd}{xy}
      const rax = start.x - dy;
      const ray = start.y + dx;
      const rbx = start.x + dy;
      const rby = start.y - dx;
      const rcx = end.x - dy;
      const rcy = end.y + dx;
      const rdx = end.x + dy;
      const rdy = end.y - dx;
      vertArr.push(rax, ray, rbx, rby, rcx, rcy, rbx, rby, rcx, rcy, rdx, rdy);
    }
    vertColors.push(...Array(vertArr.length / 2).fill([0, 0, 0, 255]).flat());
    // Load data into GL
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertArr), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(vertColors), gl.STATIC_DRAW);
    this.pointsInBuf = this.points.length;
  }
  glStateLost(): void {
    this.verticesBuf = null;
    this.colorsBuf = null;
    this.pointsInBuf = 0;
  }
  drawGL(glController: GLController, transform: mat3): void {
    if (this.pointsInBuf < 2)
      return;
    const gl = NonNull(glController.glContext());
    const program: GLProgram = glController.colorTrianges;
    gl.useProgram(program.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuf);
    gl.enableVertexAttribArray(program.getAttrLocation('position'));
    gl.vertexAttribPointer(
      program.getAttrLocation('position'), // location
      2,                  // size (components per iteration)
      gl.FLOAT,           // type
      false,              // normalize
      0,                  // stride
      0,                  // offset
      );
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuf);
    gl.enableVertexAttribArray(program.getAttrLocation('color'));
    gl.vertexAttribPointer(
      program.getAttrLocation('color'), // location
      4,                  // size (components per iteration)
      gl.UNSIGNED_BYTE,  // type
      true,              // normalize
      0,                  // stride
      0,                  // offset
      );
    gl.uniformMatrix3fv(program.getULocation('transform'), false, transform);
    gl.drawArrays(gl.TRIANGLES, 0, 6 * (this.pointsInBuf - 1));
  }
}
