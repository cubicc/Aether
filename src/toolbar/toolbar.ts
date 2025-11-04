import { ToolType, ToolbarState, CanvasElement } from './types';
import { updateToolButtonState, updateCanvasCursor } from './ui';

// 工具栏状态
const state: ToolbarState = {
  currentTool: 'select',
  canvasElements: new Map(),
  nextElementId: 1
};

// 获取当前工具
export function getCurrentTool(): ToolType {
  return state.currentTool;
}

// 切换工具
export function switchTool(tool: ToolType, canvasContent: HTMLElement | null = null): void {
  state.currentTool = tool;
  
  // 更新工具按钮状态
  updateToolButtonState(tool);
  
  // 更新画布光标
  updateCanvasCursor(tool, canvasContent);
}

// 创建文字元素
export function createTextElement(x: number, y: number, canvasContent: HTMLElement | null): HTMLElement | null {
  if (!canvasContent) return null;
  
  const elementId = `text-element-${state.nextElementId++}`;
  
  // 创建文字元素
  const textElement = document.createElement('div');
  textElement.className = 'canvas-element text-element';
  textElement.id = elementId;
  textElement.contentEditable = 'true';
  textElement.style.left = `${x}px`;
  textElement.style.top = `${y}px`;
  textElement.innerText = '双击编辑文字';
  
  // 添加到画布
  canvasContent.appendChild(textElement);
  
  // 存储元素
  state.canvasElements.set(elementId, textElement);
  
  // 使元素可拖拽
  makeElementDraggable(textElement);
  
  // 自动选中文字
  textElement.focus();
  // 选中所有文字
  const range = document.createRange();
  range.selectNodeContents(textElement);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  
  return textElement;
}

// 创建矩形元素
export function createRectElement(x: number, y: number, canvasContent: HTMLElement | null): HTMLElement | null {
  if (!canvasContent) return null;
  
  const elementId = `rect-element-${state.nextElementId++}`;
  
  // 创建矩形元素
  const rectElement = document.createElement('div');
  rectElement.className = 'canvas-element rect-element';
  rectElement.id = elementId;
  rectElement.style.left = `${x}px`;
  rectElement.style.top = `${y}px`;
  rectElement.style.width = '150px';
  rectElement.style.height = '100px';
  
  // 创建调整大小的手柄
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'resize-handle se';
  rectElement.appendChild(resizeHandle);
  
  // 添加到画布
  canvasContent.appendChild(rectElement);
  
  // 存储元素
  state.canvasElements.set(elementId, rectElement);
  
  // 使元素可拖拽和可调整大小
  makeElementDraggable(rectElement);
  makeElementResizable(rectElement, resizeHandle);
  
  return rectElement;
}

// 使画布元素可拖拽
function makeElementDraggable(element: HTMLElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  
  element.addEventListener('mousedown', (e) => {
    // 如果是文字元素且处于编辑状态，不启动拖拽
    if (element.classList.contains('text-element') && element.contentEditable === 'true') {
      return;
    }
    
    // 如果是调整大小的手柄，不启动拖拽
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return;
    }
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;
    element.style.zIndex = '1000';
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    element.style.left = `${initialLeft + dx}px`;
    element.style.top = `${initialTop + dy}px`;
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.zIndex = '';
    }
  });
}

// 使元素可调整大小
function makeElementResizable(element: HTMLElement, handle: HTMLElement): void {
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let initialWidth = 0;
  let initialHeight = 0;
  
  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    initialWidth = element.offsetWidth;
    initialHeight = element.offsetHeight;
    element.style.zIndex = '1000';
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    element.style.width = `${Math.max(50, initialWidth + dx)}px`;
    element.style.height = `${Math.max(50, initialHeight + dy)}px`;
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      element.style.zIndex = '';
    }
  });
}

// 处理画布点击事件
export function handleCanvasClick(
  e: MouseEvent, 
  canvasContent: HTMLElement | null,
  canvasTransform: { x: number; y: number; scale: number }
): boolean {
  if (!canvasContent) return false;
  
  const currentTool = state.currentTool;
  
  // 如果当前工具不是选择工具，创建对应元素
  if (currentTool === 'text') {
    // 计算相对于画布内容的位置
    const rect = canvasContent.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
    const y = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
    createTextElement(x, y, canvasContent);
    return true; // 表示事件已处理
  } else if (currentTool === 'rect') {
    // 计算相对于画布内容的位置
    const rect = canvasContent.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
    const y = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
    createRectElement(x, y, canvasContent);
    return true; // 表示事件已处理
  }
  
  return false; // 表示事件未处理，应该继续画布拖拽
}

// 初始化工具栏
export function initToolbar(canvasContent: HTMLElement | null = null): void {
  // 绑定工具栏按钮事件
  const buttons = {
    select: document.getElementById('select-tool'),
    text: document.getElementById('text-tool'),
    rect: document.getElementById('rect-tool')
  };
  
  buttons.select?.addEventListener('click', () => switchTool('select', canvasContent));
  buttons.text?.addEventListener('click', () => switchTool('text', canvasContent));
  buttons.rect?.addEventListener('click', () => switchTool('rect', canvasContent));
  
  // 设置初始工具状态
  switchTool(state.currentTool, canvasContent);
}