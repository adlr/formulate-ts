// Copyright...

export class Button {
  private div: HTMLDivElement;
  private enabled: boolean;
  constructor(div: HTMLDivElement, enabled: boolean = true) {
    this.div = div;
    this.div.addEventListener('click', (event) => { this.handleClick(event); })
    this.enabled = enabled;
    this.setEnabled(this.enabled);
  }
  private clickCB: (() => void) | null = null;
  onClick(cb: () => void) {
    this.clickCB = cb;
  }
  private handleClick(event: MouseEvent): void {
    if (this.clickCB !== null && this.enabled)
      this.clickCB();
  }
  setEnabled(en: boolean): void {
    this.enabled = en;
    if (en)
      this.div.classList.add('toolbar-button-enabled');
    else
      this.div.classList.remove('toolbar-button-enabled');
  }
  setSelected(selected: boolean): void {
    if (selected)
      this.div.classList.add('toolbar-button-selected');
    else
      this.div.classList.remove('toolbar-button-selected');
  }
}

export class ButtonSelectGroup {
  private buttons: Array<Button>;
  private selectedIndex: number = 0;
  constructor(buttons: Array<Button>) {
    this.buttons = buttons;
    this.buttons.forEach((btn: Button, index: number) => {
      btn.onClick(() => {
        this.handleButtonClicked(index);
      });
      btn.setSelected(index == 0);
    });
  }
  private clickCB: ((index: number) => void) | null = null;
  private handleButtonClicked(index: number) {
    if (index === this.selectedIndex)
      return;
    // update style to show which is selected
    this.buttons[this.selectedIndex].setSelected(false);
    this.selectedIndex = index;
    this.buttons[this.selectedIndex].setSelected(true);

    if (this.clickCB !== null)
      this.clickCB(index);
  }
  onChange(cb: (index: number) => void): void {
    this.clickCB = cb;
  }
}
