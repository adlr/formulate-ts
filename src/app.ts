import DocView from './docview';
import PDFDoc from './pdfdoc';

async function main(): Promise<void> {
  let docView = new DocView('doc');
  let response = await fetch('../demo.pdf');
  if (!response.ok) {
    throw new Error('' + response.status);
  }
  let buffer = await response.arrayBuffer();
  let pdfdoc = new PDFDoc();
  await pdfdoc.init(new Uint8Array(buffer));
  console.log(`got ${pdfdoc.pageCount()} pages`);
}

window.onload = () => {
  main();
}
