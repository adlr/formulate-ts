import DocView from './docview';
import PDFDoc from './pdfdoc';

function main(): void {
  let docView = new DocView('doc');
  fetch('../demo.pdf').then(response => {
    if (!response.ok) {
      throw new Error('' + response.status);
    }
    return response.arrayBuffer();
  }).then(buffer => {
    let pdfdoc = new PDFDoc(new Uint8Array(buffer));
    console.log(`got ${pdfdoc.pageCount()} pages`);
  })
}

window.onload = main;
