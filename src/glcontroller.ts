// Copyright...

import { NonNull, Rect, Size } from "./geometry";

export class Texture {
  tex: WebGLTexture;
  size: Size;  // in pixels
  pageLoc: Rect;  // page coordinates
  posBuf: WebGLBuffer;
  texCoordBuf: WebGLBuffer;  // TODO: share one for all Texture objects
  // constructor(tex: WebGLTexture, size: Size, pageLoc: Rect) {
  //   this.tex = tex;
  //   this.size = size;
  //   this.pageLoc = pageLoc;
  // }
  constructor(gl: WebGLRenderingContext, pointer: Uint8ClampedArray, size: Size, pageLoc: Rect) {
    this.tex = NonNull(gl.createTexture());
    this.size = size;
    this.pageLoc = pageLoc;

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const blend = true;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blend ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, blend ? gl.LINEAR : gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pointer);
    this.posBuf = NonNull(gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      pageLoc.left(), pageLoc.top(),
      pageLoc.left(), pageLoc.bottom(),
      pageLoc.right(), pageLoc.top(),
      pageLoc.left(), pageLoc.bottom(),
      pageLoc.right(), pageLoc.top(),
      pageLoc.right(), pageLoc.bottom(),
    ]), gl.STATIC_DRAW);
    this.texCoordBuf = NonNull(gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      0, 1,
      1, 0,
      0, 1,
      1, 0,
      1, 1,
    ]), gl.STATIC_DRAW);
    this.free = () => {
      gl.deleteTexture(this.tex);
      gl.deleteBuffer(this.posBuf);
      gl.deleteBuffer(this.texCoordBuf);
      this.size.reset();
      this.pageLoc.reset();
    }
  }
  public free: () => void;
  // free(gl: WebGLRenderingContext): void {
  // }
  // Update the gl buffer coordinates based on the new page coordinates
  pageLocUpdated(gl: WebGLRenderingContext): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      this.pageLoc.left(), this.pageLoc.top(),
      this.pageLoc.left(), this.pageLoc.bottom(),
      this.pageLoc.right(), this.pageLoc.top(),
      this.pageLoc.left(), this.pageLoc.bottom(),
      this.pageLoc.right(), this.pageLoc.top(),
      this.pageLoc.right(), this.pageLoc.bottom(),
    ]), gl.STATIC_DRAW);
  }
  // Returns true iff |rect| (in page coords) is covered by |pageLoc|.
  // If |size| is passed and |rect| is covered, returns true iff the covered size is at least
  // |size| pixels.
  contains(rect: Rect, size: Size = new Size()): boolean {
    if (!this.pageLoc.contains(rect)) {
      //console.log(`${this.pageLoc} doesn't contain ${rect}`);
      return false;
    }
    if (size.width < 1 || size.height < 1)
      return true;
    const coveredWidth = rect.size.width * this.size.width / this.pageLoc.size.width;
    const coveredHeight = rect.size.height * this.size.height / this.pageLoc.size.height;
    const ret = (coveredWidth >= size.width) && (coveredHeight >= size.height);
    return ret;
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
  readonly drawTex: GLProgram;
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
    this.drawTex = new GLProgram(gl, createProgram(gl, `
        attribute vec2 position;
        attribute vec2 texcoord;
        
        uniform mat3 transform;
        
        varying vec2 v_texcoord;
        
        void main() {
          gl_Position = vec4((transform * vec3(position, 1)).xy, 0, 1);
          v_texcoord = texcoord;
        }
        `, `
        precision mediump float;
 
        varying vec2 v_texcoord;
        
        uniform sampler2D u_texture;
        
        void main() {
          gl_FragColor = texture2D(u_texture, v_texcoord);
        }
        `), [['position', false], ['texcoord', false], ['u_texture', true], ['transform', true]]);
  }
  glContext(): WebGLRenderingContext | null {
    return this.canvas.getContext('webgl');
  }
}