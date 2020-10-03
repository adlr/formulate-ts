// Copyright...

export class Size {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  set(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  set(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}

export class Rect {
  size: Size;
  origin: Point;
  constructor(x: number, y: number, width: number, height: number) {
    this.size = new Size(width, height);
    this.origin = new Point(x, y);
  }
  static FromSizeOrigin(size: Size, origin: Point): Rect {
    return new Rect(origin.x, origin.y, size.width, size.height);
  }
}