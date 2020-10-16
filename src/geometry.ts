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
  reset(): void {
    this.set(0, 0);
  }
  isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
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
  reset(): void {
    this.set(0, 0, 0, 0);
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
  // Sets this to the intersection of this and rect
  intersectWithLTRB(l: number, t: number, r: number, b: number): void {
    this.setLeft(Math.max(this.left(), l));
    this.setRight(Math.min(this.right(), r));
    this.setTop(Math.max(this.top(), t));
    this.setBottom(Math.min(this.bottom(), b));
  }
  intersectWith(rect: Rect): void {
    this.intersectWithLTRB(rect.left(), rect.top(), rect.right(), rect.bottom());
  }
  intersect(rect: Rect): Rect {
    const ret = Rect.FromRect(this);
    ret.intersectWith(rect);
    return ret;
  }
  contains(rect: Rect): boolean {
    return this.left() <= rect.left() &&
        this.top() <= rect.top() &&
        this.right() >= rect.right() &&
        this.bottom() >= rect.bottom();
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

export class Color {
  readonly rgba = [0, 0, 0, 0];
}

// Range covers [start, end)
export class Range {
  start: number;
  end: number;
  constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
  set(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
  size(): number {
    return this.end - this.start;
  }
  isEmpty(): boolean {
    return this.end <= this.start;
  }
  contains(n: number): boolean {
    return n >= this.start && n < this.end;
  }
  equals(that: Range): boolean {
    return this.start == that.start && this.end == that.end;
  }
}

export function NonNull<T>(input: T | null): T {
  if (!input) {
    throw new Error("Unexpected null value");
  }
  return input;
}