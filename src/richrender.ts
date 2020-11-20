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
      textStyle: TextStyle.DefaultStyle().toSkia(),
      textAlign: CanvasKit.TextAlign.Left,
      maxLines: 999,
      ellipsis: '...',
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paraStyle, FontMgr);
    parseHTML(text, (fragment: string, style: TextStyle) => {
      builder.pushStyle(style.toSkia());
      console.log(`adding text: ${fragment}`);
      builder.addText(fragment);
      builder.pop();
    });
    this.paragraph = builder.build();
  }
  // returns true if changes were made
  wrap(width: number): boolean {
    if (width == this.lastWrappedAt)
      return false;
    console.log(`wrapping text to ${width}`);
    this.paragraph.layout(width);
    this.lastWrappedAt = width;
    return true;
  }
  renderToTexture(gl: WebGLRenderingContext, origin: Point, zoom: number): Texture {
    this.lastRenderZoom = zoom;
    const height: number = this.paragraph.getHeight();
    const width: number = this.paragraph.getLongestLine();
    console.log(`render width: ${width} height: ${height}`);
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

class TextStyle {
  fonts: Array<string>;
  size: number;
  bold: boolean;
  italic: boolean;
  constructor(fonts: Array<string>, size: number, bold: boolean, italic: boolean) {
    this.fonts = fonts;
    this.size = size;
    this.bold = bold;
    this.italic = italic;
  }
  static DefaultStyle(): TextStyle {
    return new TextStyle(['Open Sans', 'Noto Color Emoji'], 12, false, false);
  }
  copy(): TextStyle {
    return new TextStyle([...this.fonts], this.size, this.bold, this.italic);
  }
  toSkia(): Object {
    return CanvasKit.TextStyle({
      fontFamilies: this.fonts,
      fontSize: this.size,
      fontStyle: {
        weight: this.bold ? CanvasKit.FontWeight.Bold : CanvasKit.FontWeight.Normal,
        slant: this.italic ? CanvasKit.FontSlant.Italic : CanvasKit.FontSlant.Upright,
      },
    });
  }
}

function parseHTML(html: string, pushText: (text: string, style: Object) => void): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content.cloneNode(true);
  const styles: Array<TextStyle> = [TextStyle.DefaultStyle()];
  let onFirstParagraph: boolean = true;

  const handleElement = (node: Element) => {
    styles.push(styles[styles.length - 1].copy());
    const topStyle: TextStyle = styles[styles.length - 1];
    if (node.tagName === "P") {
      if (onFirstParagraph === false)
        pushText("\n", styles[styles.length - 1]);
    }
    if (node.tagName === "B") {
      topStyle.bold = true;
    }
    if (node.tagName === "I") {
      topStyle.italic = true;
    }
    if (node.hasChildNodes()) {
      innerWalk(node.childNodes);
    }
    if (node.tagName === "P") {
      onFirstParagraph = false;
    }
    styles.pop();
  };

  const innerWalk = (nodes: NodeListOf<ChildNode>) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          handleElement(<Element>node);
          break;
        case Node.TEXT_NODE:
          pushText(NonNull(node.textContent), styles[styles.length - 1]);
          break;
        default:
          throw new Error(`Unhandled nodetype ${node.nodeType}`);
      }
    }
  };
  innerWalk(root.childNodes);
}
