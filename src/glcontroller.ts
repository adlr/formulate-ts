// Copyright...

import { Rect, Size } from "./geometry";

export class Texture {
  tex: WebGLTexture;
  size: Size;  // in pixels
  pageLoc: Rect;  // page coordinates
  constructor(tex: WebGLTexture, size: Size, pageLoc: Rect) {
    this.tex = tex;
    this.size = size;
    this.pageLoc = pageLoc;
  }
  free(gl: WebGLRenderingContext): void {
    gl.deleteTexture(this.tex);
    this.size.reset();
    this.pageLoc.reset();
  }
}

export class GLProgram {
  program: WebGLProgram;
  attrLocations: Map<string, number> = new Map;
  uLocations: Map<string, WebGLUniformLocation> = new Map;
  constructor(gl: WebGLRenderingContext, program: WebGLProgram, locations: Array<[string, boolean]>) {  // [name, is_uniform]
    this.program = program;
    for (let i = 0; i < locations.length; i++) {
      const name = locations[i][0];
      const isUniform = locations[i][1];
      if (isUniform) {
        const loc = gl.getUniformLocation(program, name);
        if (loc === null)
          throw new Error("Can't find uniform named " + name + ", " + gl.getError() + " (" + gl.NO_ERROR + ")");
        this.uLocations.set(name, loc);
      } else {
        const loc = gl.getAttribLocation(program, name);
        if (loc == -1)
          throw new Error("Can't find attribute named " + name);
        this.attrLocations.set(name, loc);
      }
    }
  }
  getAttrLocation(attr: string): number {
    if (!this.attrLocations.has(attr))
      throw new Error('Unable to look up attribute ' + attr);
    return this.attrLocations.get(attr)!;
  }
  getULocation(u: string): WebGLUniformLocation {
    if (!this.uLocations.has(u))
      throw new Error('Unable to look up uniform ' + u);
    return this.uLocations.get(u)!;
  }
}

function createShader(gl: WebGLRenderingContext, type: number, glsl: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader)
    throw new Error("Can't create webgl shader");
  gl.shaderSource(shader, glsl);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error('Shader Compiler error: ' + gl.getShaderInfoLog(shader));
  return shader;
};

function createProgram(gl: WebGLRenderingContext, vGLSL: string, fGLSL: string): WebGLProgram {
  const prg = gl.createProgram();
  if (!prg)
    throw new Error("Can't create webgl program");
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vGLSL);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fGLSL);
  gl.attachShader(prg, vertexShader);
  gl.attachShader(prg, fragmentShader);
  gl.linkProgram(prg);
  if (!gl.getProgramParameter(prg, gl.LINK_STATUS))
    throw new Error('GL Program Link Error: ' + gl.getProgramInfoLog(prg));

  gl.detachShader(prg, vertexShader);
  gl.deleteShader(vertexShader);
  gl.detachShader(prg, fragmentShader);
  gl.deleteShader(fragmentShader);

  return prg;
}

export class GLController {
  private readonly canvas: HTMLCanvasElement;
  readonly colorTrianges: GLProgram;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    let gl = canvas.getContext('webgl');
    if (gl === null) {
      throw new Error('unable to get webgl context');
    }
 
    this.colorTrianges = new GLProgram(gl, createProgram(gl, `
        attribute vec2 position;
        attribute vec4 color;
        uniform mat3 transform;

        varying vec4 v_color;
        void main() {
          gl_Position = vec4((transform * vec3(position, 1)).xy, 0, 1);
          v_color = color;
        }`, `
        precision mediump float;
        varying vec4 v_color;
        void main() {
          gl_FragColor = v_color;
        }`), [['position', false], ['color', false], ['transform', true]]);
  }
  glContext(): WebGLRenderingContext | null {
    return this.canvas.getContext('webgl');
  }
}