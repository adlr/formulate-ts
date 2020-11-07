// Copyright...

// See https://quilljs.com/guides/adding-quill-to-your-build-pipeline/#entry
import Quill from "quill/core";
import Toolbar from 'quill/modules/toolbar';
import Snow from 'quill/themes/snow';

import Bold from 'quill/formats/bold';
import Italic from 'quill/formats/italic';

Quill.register({
  'modules/toolbar': Toolbar,
  'themes/snow': Snow,
  'formats/bold': Bold,
  'formats/italic': Italic,
});

// This class is glue to the Quill editor

export interface RichEditor {

}

export function CreateRichEditor(parent: HTMLDivElement) {
  return new QuillRichEditor(parent);
}

class QuillRichEditor implements RichEditor {
  private readonly quill: Quill;
  constructor(parent: HTMLDivElement) {
    parent.id = 'quill-editor';
    parent.style.height = 'auto';
    this.quill = new Quill('#quill-editor', {
      modules: { toolbar: false },
      placeholder: 'Text',
      theme: 'snow'});
    this.quill.on('text-change', (delta, oldDelta, source) => {
      console.log('text change');
    });
    this.quill.enable();
  }
}

window.addEventListener('load', () => {
  const bold = Quill.import('formats/bold');
  bold.tagName = 'b';   // Quill uses <strong> by default
  Quill.register(bold, true);

  const italic = Quill.import('formats/italic');
  italic.tagName = 'i';   // Quill uses <em> by default
  Quill.register(italic, true);
});
