// Copyright...

export class Size {
  width: number;
  height: number;
  constructor(width: number = 0, height: number = 0) {
    this.width = width;
    this.height = height;
  }
  static FromSize(size: Size): Size {
    return new Size(size.width, size.height);
  }
  toString(): string {
    return `Size(${this.width}, ${this.height})`;
  }
  set(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

export class Point {
  x: number;
  y: number;
  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
  toString(): string {
    return `Point(${this.x}, ${this.y})`;
  }
  set(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}

// |Rect|s grow downward as height increases

export class Rect {
  readonly size: Size;
  readonly origin: Point;
  constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
    this.size = new Size(width, height);
    this.origin = new Point(x, y);
  }
  static FromSizeOrigin(size: Size, origin: Point): Rect {
    return new Rect(origin.x, origin.y, size.width, size.height);
  }
  static FromSize(size: Size): Rect {
    return new Rect(0, 0, size.width, size.height);
  }
  static FromRect(rect: Rect): Rect {
    return Rect.FromSizeOrigin(rect.size, rect.origin);
  }
  toString(): string {
    return `Rect(${this.size}, ${this.origin})`;
  }
  set(x: number, y: number, width: number, height: number): void {
    this.size.width = width;
    this.size.height = height;
    this.origin.x = x;
    this.origin.y = y;
  }
  left(): number {
    return this.origin.x;
  }
  top(): number {
    return this.origin.y;
  }
  right(): number {
    return this.origin.x + this.size.width;
  }
  bottom(): number {
    return this.origin.y + this.size.height;
  }
  setLeft(left: number) {
    const delta = this.origin.x - left;
    this.size.width += delta;
    this.origin.x = left;
  }
  setTop(top: number) {
    const delta = this.origin.y - top;
    this.size.height += delta;
    this.origin.y = top;
  }
  setRight(right: number) {
    this.size.width = right - this.origin.x;
  }
  setBottom(bottom: number) {
    this.size.height = bottom - this.origin.y;
  }
  intersects(rect: Rect): boolean {
    const l = Math.max(this.left(), rect.left());
    const r = Math.min(this.right(), rect.right());
    if (l >= r)
      return false;
    const t = Math.max(this.top(), rect.top());
    const b = Math.min(this.bottom(), rect.bottom());
    return t < b;
  }
  // Updates this rectanble to be smaller by |delta| on each side.
  insetBy(delta: number) {
    this.origin.x += delta;
    this.origin.y += delta;
    this.size.width -= delta * 2;
    this.size.height -= delta * 2;
  }
  outsetBy(delta: number) {
    this.insetBy(-delta);
  }
}