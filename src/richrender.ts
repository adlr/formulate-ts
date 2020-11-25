// Copyright...

import { NonNull, Point, Rect, Size } from "./geometry";
import { Texture } from "./glcontroller";
import CanvasKitInit from '../canvaskit/bin/core/canvaskit.js';

let CanvasKit: any | null = null;
let FontMgr: any | null = null;

function TryLoadFontMgr(): void {
  if (FontMgr !== null)
    return;
  if (CanvasKit === null)
    return;
  if (fonts.size !== fontsToLoad.length)
    return;
  const fontData: Array<ArrayBuffer> = [];
  for (let item of fonts) {
    fontData.push(item[1]);
  }
  FontMgr = CanvasKit.SkFontMgr.FromData(fontData);
  fonts.clear();
}

let fonts: Map<string, ArrayBuffer> = new Map();
let fontsToLoad: Array<string> = [
  'Merriweather-BoldItalic',
  'Merriweather-Bold',
  'Merriweather-Italic',
  'Merriweather-Regular',
  'NotoColorEmoji',
  'NotoEmoji-Regular',
  'NotoSansSymbols2-Regular',
  'NotoSansSymbols-Bold',
  'NotoSansSymbols-Regular',
  'OpenSans-BoldItalic',
  'OpenSans-Bold',
  'OpenSans-Italic',
  'OpenSans-Regular',
  'Roboto-Regular',
  'WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SII',
];

// Wait a few seconds for other things to load, since this is not immediately needed on startup
setTimeout(() => {
  CanvasKitInit({locateFile: (file) => '../canvaskit/bin/core/' + file }).then((ck) => {
    CanvasKit = ck;
    TryLoadFontMgr();
  });
  fontsToLoad.forEach((name) => {
    fetch(`../fonts/${name}.ttf`).then((resp) => {
      resp.arrayBuffer().then((buffer) => {
        console.log(`${name} loaded`);
        fonts.set(name, buffer);
        TryLoadFontMgr();
      });
    });
  });  
}, 2000);

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
    builder.delete();
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
  renderToTexture(gl: WebGLRenderingContext, origin: Point, clipRect: Rect, zoom: number): Texture {
    this.lastRenderZoom = zoom;
    const height: number = this.paragraph.getHeight();
    const width: number = this.paragraph.getLongestLine();
    const rect: Rect = new Rect(origin.x, origin.y, width, height);
    rect.intersectWith(clipRect);
    const outSize: Size = new Size(Math.ceil(rect.size.width * zoom), Math.ceil(rect.size.height * zoom));
    // Since we rounded up `outSize`, let's correct `rect` accordingly
    rect.size.width = outSize.width / zoom;
    rect.size.height = outSize.height / zoom;
    outSize.width = Math.max(1, outSize.width);
    outSize.height = Math.max(1, outSize.height);
    console.log(`Rendering Pixel size: ${outSize}`);
    const surface = CanvasKit.MakeSurface(outSize.width, outSize.height);
    const canvas = surface.getCanvas();
    canvas.clear(CanvasKit.TRANSPARENT);
    canvas.scale(zoom, zoom);
    canvas.translate(origin.x - rect.origin.x, origin.y - rect.origin.y);
    if (height > 1) {
      canvas.drawParagraph(this.paragraph, 0, 0);
    }

    // let arr = new Uint8ClampedArray(CanvasKit.HEAPU8.buffer,
    //   surface.pixelPtr, outSize.width * outSize.height * 4);
    const arr: Uint8ClampedArray = surface.getPixelBuf();
    const ret = new Texture(gl, arr, outSize, rect);
    console.log(`rendered text tex at ${rect.origin.x}, ${rect.origin.y} (${rect.origin.x * window.devicePixelRatio}, ${rect.origin.y * window.devicePixelRatio})`);
    surface.dispose();
    return ret;
  }
  lastRenderedZoom(): number { return this.lastRenderZoom; }
  // Renders the text to a PDF and calls `write` with the resulting bytes.
  // `write` is called before this method returns, and the data passed to `write` is
  // only valid during that call.
  renderToPDF(write: (bytes: Uint8Array, width: number, height: number) => void): void {
    console.log(`Rendering to PDF!`);
    const outStream = new CanvasKit.SkDynamicMemoryWStream();
    const doc = CanvasKit.SkPDFMakeDocument(outStream);
    const height: number = this.paragraph.getHeight();
    const width: number = this.paragraph.getLongestLine();
    const canvas = doc.beginPage(width, height, 0);
    canvas.drawParagraph(this.paragraph, 0, 0);
    doc.endPage();
    doc.close();
    doc.delete();
    // make copy of data to return
    let pdfBuf = outStream.detachAsData();
    let bytes: Uint8Array = CanvasKit.getSkDataBytes(pdfBuf);
    write(bytes, width, height);
    pdfBuf.delete();
    outStream.delete();
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
    return new TextStyle(['Open Sans', 'Noto Color Emoji'], 13, false, false);
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
