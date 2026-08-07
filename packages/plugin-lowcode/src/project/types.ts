export interface SlotInfo {
  id: string;
  title?: string;
  layout?: any;
  components?: OutlineNode[];
}

export interface OutlineNode {
  id?: string;
  title?: string;
  def?: { namespace?: string };
  asRoot?: boolean;
  data?: any;
  style?: any;
  layout?: any;
  components?: OutlineNode[];
  slots?: SlotInfo[];
}

export interface SourceRange {
  startLine: number;
  endLine: number;
}

export interface SourceNodeRecord extends SourceRange {
  id?: string;
  title?: string;
  namespace?: string;
  parentId?: string;
  slotId?: string;
  node: OutlineNode;
}

export interface PageSource {
  lines: string[];
  nodes: SourceNodeRecord[];
}

export interface LowCodeGrepFilters {
  namespace?: string | string[];
  title?: string;
  text?: string;
  configPath?: string;
  configValue?: string | number | boolean;
  position?: "fixed" | "absolute" | "relative";
  parentId?: string;
  slotId?: string;
}

export interface LowCodeGrepParams {
  query?: string;
  pageId?: string;
  filters?: LowCodeGrepFilters;
  before?: number;
  after?: number;
  limit?: number;
}

export interface LowCodeReadParams {
  pageId: string;
  startLine: number;
  endLine: number;
}
