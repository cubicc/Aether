import { ToolType, ToolConfig } from './types';

// 工具栏配置
export const TOOL_CONFIGS: ToolConfig[] = [
  {
    id: 'select-tool',
    type: 'select',
    label: '选择',
    icon: '↖',
    active: true
  },
  {
    id: 'text-tool',
    type: 'text',
    label: '文字',
    icon: 'T',
    active: false
  },
  {
    id: 'rect-tool',
    type: 'rect',
    label: '矩形',
    icon: '▭',
    active: false
  }
];

// 创建工具栏HTML元素
export function createToolbar(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.id = 'toolbar';
  toolbar.className = 'toolbar';
  
  TOOL_CONFIGS.forEach(config => {
    const toolBtn = document.createElement('button');
    toolBtn.id = config.id;
    toolBtn.className = `tool-btn ${config.active ? 'active' : ''}`;
    toolBtn.title = config.label;
    toolBtn.textContent = config.icon;
    
    toolbar.appendChild(toolBtn);
  });
  
  return toolbar;
}

// 获取工具栏按钮元素
export function getToolbarButtons(): Record<ToolType, HTMLElement | null> {
  return {
    select: document.getElementById('select-tool'),
    text: document.getElementById('text-tool'),
    rect: document.getElementById('rect-tool')
  };
}

// 更新工具按钮状态
export function updateToolButtonState(activeTool: ToolType): void {
  const buttons = getToolbarButtons();
  
  Object.entries(buttons).forEach(([toolType, button]) => {
    if (button) {
      if (toolType === activeTool) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  });
}

// 更新画布光标样式
export function updateCanvasCursor(tool: ToolType, canvasContent: HTMLElement | null): void {
  if (!canvasContent) return;
  
  switch (tool) {
    case 'select':
      canvasContent.style.cursor = 'default';
      break;
    case 'text':
      canvasContent.style.cursor = 'text';
      break;
    case 'rect':
      canvasContent.style.cursor = 'crosshair';
      break;
  }
}