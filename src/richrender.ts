// Copyright...

import { NonNull, Point, Rect, Size } from "./geometry";
import { GLController, Texture } from "./glcontroller";
import CanvasKitInit from '../canvaskit/bin/core/canvaskit.js';


// const canvas = document.createElement('canvas');

// export async function RenderText(glController: GLController, text: string, pageRect: Rect, outSize: Size): Texture {
//   return new Promise((resolve, reject) => {
//     const data = 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="' +
//         outSize.width + '" height="' + outSize.height + '"><foreignObject width="100%" height="100%">' +
//         text + '</foreignObject></svg>';
//     const image = new Image();
//     image.addEventListener('load', () => {
//       const gl = NonNull(glController.glContext());
      
//       resolve(image);
//     });
//     image.addEventListener('error', (error) => { reject(error); });
//     image.src = data;
// });
// }

let CanvasKit: any | null = null;
let FontMgr: any | null = null;

function TryLoadFontMgr(): void {
  if (FontMgr !== null)
    return;
  if (CanvasKit === null)
    return;
  if (fonts.size !== 2)
    return;
  const fontData: Array<ArrayBuffer> = [];
  for (let item of fonts) {
    fontData.push(item[1]);
  }
  FontMgr = CanvasKit.SkFontMgr.FromData(fontData);
}

CanvasKitInit({locateFile: (file) => '../canvaskit/bin/core/' + file }).then((ck) => {
  CanvasKit = ck;
  TryLoadFontMgr();
});

let fonts: Map<string, ArrayBuffer> = new Map();
let fontsToLoad: Array<string> = ['OpenSans-Regular', 'NotoColorEmoji'];
fontsToLoad.forEach((name) => {
  fetch(`../fonts/${name}.ttf`).then((resp) => {
    resp.arrayBuffer().then((buffer) => {
      console.log(`${name} loaded`);
      fonts.set(name, buffer);
      TryLoadFontMgr();
    });
  });
});

export default class RichRender {
  private paragraph: any = null;
  private lastWrappedAt: number = 0;
  private lastRenderZoom: number = -1;  // starts out invalid
  constructor() {
    if (CanvasKit === null) {
      throw new Error("CanvasKit didn't load");
    }
    if (FontMgr === null) {
      throw new Error("Fonts are loaded yet");
    }
    this.setText('');
  }
  setText(text: string): void {
    const paraStyle = new CanvasKit.ParagraphStyle({
      textStyle: {
        color: CanvasKit.BLACK,
        fontFamilies: ['Open Sans', 'Noto Color Emoji'],
        fontSize: 12,
      },
      textAlign: CanvasKit.TextAlign.Left,
      maxLines: 999,
      ellipsis: '...',
    });
  
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, FontMgr);
    builder.addText(text);
    this.paragraph = builder.build();
  }
  // returns true if changes were made
  wrap(width: number): boolean {
    if (width == this.lastWrappedAt)
      return false;
    this.paragraph.layout(width);
    this.lastWrappedAt = width;
    return true;
  }
  renderToTexture(gl: WebGLRenderingContext, origin: Point, zoom: number): Texture {
    this.lastRenderZoom = zoom;
    const height: number = this.paragraph.getHeight();
    const width: number = this.paragraph.getLongestLine();
    const rect: Rect = new Rect(origin.x, origin.y, width, height);
    const outSize: Size = new Size(Math.ceil(width * zoom), Math.ceil(height * zoom));
    // Since we rounded up `outSize`, let's correct `rect` accordingly
    rect.size.width = outSize.width / zoom;
    rect.size.height = outSize.height / zoom;
    outSize.width = Math.max(1, outSize.width);
    outSize.height = Math.max(1, outSize.height);
    const surface = CanvasKit.MakeSurface(outSize.width, outSize.height);
    const canvas = surface.getCanvas();
    canvas.clear(CanvasKit.CYAN);
    canvas.scale(zoom, zoom);
    if (height > 1) {
      canvas.drawParagraph(this.paragraph, 0, 0);
    }
    const tex = NonNull(gl.createTexture());

    let arr = new Uint8ClampedArray(CanvasKit.HEAPU8.buffer,
      surface.pixelPtr, outSize.width * outSize.height * 4);

    return new Texture(gl, arr, outSize, rect);
  }
  lastRenderedZoom(): number { return this.lastRenderZoom; }
  renderToPDF() {
  }
}
