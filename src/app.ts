import { Button, ButtonSelectGroup } from './buttonbar';
import Doc from './doc';
import DocController from './doccontroller';
import DocView from './docview';
import { NonNull } from './geometry';
import { GLController } from './glcontroller';
import PDFDoc from './pdfdoc';

async function main(): Promise<void> {
  // init pdfium
  await PDFDoc.initLib();

  // fetch demo file
  fetch('../demo.pdf').then(setupLoadedDoc);

}

async function setupLoadedDoc(response) {
  if (!response.ok) {
    throw new Error('' + response.status);
  }
  let buffer = await response.arrayBuffer();
  let pdfdoc = new PDFDoc(new Uint8Array(buffer));
  const doc = new Doc(pdfdoc);
  let docView = new DocView('doc', doc);

  const canvas = document.querySelector('canvas')!;
  const glController: GLController = new GLController(canvas);
  const docController = new DocController(docView, doc, glController);
  docView.setController(docController);

  // Set up toolbar
  let group = new ButtonSelectGroup([new Button(NonNull(document.querySelector('#tb-tool-arrow'))),
                                     new Button(NonNull(document.querySelector('#tb-tool-text'))),
                                     new Button(NonNull(document.querySelector('#tb-tool-freehand')))]);
  group.onChange((index: number) => {
    docController.toolChanged(index);
  });

  docView.pagesChanged();
  docView.scrolled();
}

window.onload = () => {
  main();
}
