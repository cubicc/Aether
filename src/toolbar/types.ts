// 工具栏类型定义
export type ToolType = 'select' | 'text' | 'rect';

// 工具栏配置
export interface ToolConfig {
  id: string;
  type: ToolType;
  label: string;
  icon: string;
  active?: boolean;
}

// 画布元素接口
export interface CanvasElement {
  id: string;
  type: 'text' | 'rect';
  element: HTMLElement;
}

// 工具栏状态接口
export interface ToolbarState {
  currentTool: ToolType;
  canvasElements: Map<string, HTMLElement>;
  nextElementId: number;
}