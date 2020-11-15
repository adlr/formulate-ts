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
  text: () => string;
}

// Create a rich editor. If |width| is negative, it's set based on the contained text
export function CreateRichEditor(parent: HTMLDivElement, width: number, text: string) {
  return new QuillRichEditor(parent, width, text);
}

class QuillRichEditor implements RichEditor {
  private readonly quill: Quill;
  constructor(parent: HTMLDivElement, width: number, text: string) {
    // make a new div for Quill, since it seems to reach outside the given div.
    const div = document.createElement('div');
    div.id = 'quill-editor';
    div.style.width = width < 0 ? 'fit-content' : (Math.floor(width) + 2 + 'px');
    div.style.height = 'auto';
    div.innerHTML = text;
    parent.appendChild(div);
    this.quill = new Quill('#quill-editor', {
      modules: { toolbar: false },
      placeholder: 'Text',
      theme: 'snow'});
    this.quill.on('text-change', (delta, oldDelta, source) => {
      console.log('text change');
    });
    this.quill.enable();
    setTimeout(() => { this.quill.focus(); }, 50);
  }
  text(): string {
    return this.quill.root.innerHTML;
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
