export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children?: SvgNode[];
}

export interface IconData {
  viewBox: string;
  children: SvgNode[];
}

export interface IconSetProvider {
  name: string;
  load(): Promise<Map<string, IconData>>;
}
