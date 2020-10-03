import Doc from './doc';
import DocView from './docview';
import PDFDoc from './pdfdoc';

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
  docView.pagesChanged();

  console.log(`got ${pdfdoc.pageCount()} pages`);
}

window.onload = () => {
  main();
}
