import Doc from './doc';
import DocController from './doccontroller';
import DocView from './docview';
import { NonNull } from './geometry';
import { GLController } from './glcontroller';
import PDFDoc from './pdfdoc';

function drawTriangle(gl: WebGLRenderingContext, glController: GLController): void {
  // const vsGLSL = `
  // attribute vec2 position;
  // attribute vec4 color;
  // uniform mat3 transform;

  // varying vec4 v_color;
  // void main() {
  //     gl_Position = vec4((transform * vec3(position, 1)).xy, 0, 1);
  //     v_color = color;
  // }
  // `;
  
  // const fsGLSL = `
  // precision highp float;
  // varying vec4 v_color;
  // void main() {
  //     gl_FragColor = v_color;
  // }
  // `;
  
  // const vertexShader = NonNull(gl.createShader(gl.VERTEX_SHADER));
  // gl.shaderSource(vertexShader, vsGLSL);
  // gl.compileShader(vertexShader);
  // if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
  //   throw new Error('Error: ' + gl.getShaderInfoLog(vertexShader))
  // };
  
  // const fragmentShader = NonNull(gl.createShader(gl.FRAGMENT_SHADER));
  // gl.shaderSource(fragmentShader, fsGLSL);
  // gl.compileShader(fragmentShader);
  // if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
  //   throw new Error('Error: ' + gl.getShaderInfoLog(fragmentShader))
  // };
  
  // const prg = NonNull(gl.createProgram());
  // gl.attachShader(prg, vertexShader);
  // gl.attachShader(prg, fragmentShader);
  // gl.linkProgram(prg);
  // if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) {
  //   throw new Error('Error: ' + gl.getProgramInfoLog(prg))
  // };
  
  
  // // NOTE! These are only here to unclutter the diagram.
  // // It is safe to detach and delete shaders once
  // // a program is linked though it is arguably not common.
  // // and I usually don't do it.
  // gl.detachShader(prg, vertexShader);
  // gl.deleteShader(vertexShader);
  // gl.detachShader(prg, fragmentShader);
  // gl.deleteShader(fragmentShader);
  
  // const positionLoc = gl.getAttribLocation(prg, 'position');
  // const colorLoc = gl.getAttribLocation(prg, 'color');
  // const transformLoc = gl.getUniformLocation(prg, 'transform');
  
  const positionLoc = glController.colorTrianges.attrLocations.get('position');
  const colorLoc = glController.colorTrianges.attrLocations.get('color');
  const transformLoc = glController.colorTrianges.attrLocations.get('transform');

  if (typeof positionLoc !== "number") {
    throw new Error('pos loc not number');
  }
  if (typeof colorLoc !== "number") {
    throw new Error('colorLoc not number');
  }
  if (typeof transformLoc !== "object") {
    throw new Error('pos loc not obj');
  }

  // in clip space
  const vertexPositions = new Float32Array([
      0,   0.7,
    0.5,  -0.7,
   -0.5,  -0.7,
  ]);
  
  const colors = new Uint8Array([
    0, 1, 0.5, 1,
    1, 1, 0.5, 1,
    1, 1, 0.5, 1
].map( v => 255 * v ));

const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW);
  
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  


  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(
      positionLoc,  
      2,            // 2 values per vertex shader iteration
      gl.FLOAT,     // data is 32bit floats
      false,        // don't normalize
      0,            // stride (0 = auto)
      0,            // offset into buffer
  );

  
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.enableVertexAttribArray(colorLoc);
gl.vertexAttribPointer(
  colorLoc,  
    4,            // 2 values per vertex shader iteration
    gl.UNSIGNED_BYTE,     // data is 32bit floats
    true,        // don't normalize
    0,            // stride (0 = auto)
    0,            // offset into buffer
);


  gl.useProgram(glController.colorTrianges.program);
  gl.uniformMatrix3fv(transformLoc, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  
  // compute 3 vertices for 1 triangle
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

async function main(): Promise<void> {
  // init pdfium
  await PDFDoc.initLib();

  // fetch demo file
  let response = await fetch('../demo.pdf');
  if (!response.ok) {
    throw new Error('' + response.status);
  }
  let buffer = await response.arrayBuffer();
  let pdfdoc = new PDFDoc(new Uint8Array(buffer));
  let docView = new DocView('doc', new Doc(pdfdoc));

  const canvas = document.querySelector('canvas')!;
  const glController: GLController = new GLController(canvas);
  const docController = new DocController(docView, glController);
  docView.pagesChanged();

  
  // const gl = NonNull(canvas.getContext('webgl'));
  // docView.scrolled();
  // docView.updateGLState(gl, false);

  // //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  // gl.clear(gl.COLOR_BUFFER_BIT);
  // docView.drawGL(gl, glController.colorTrianges);
  // //drawTriangle(gl, glController);

  console.log(`got ${pdfdoc.pageCount()} pages`);
}

window.onload = () => {
  main();
}
