import './index.css';

// 定义类型
interface WindowSource {
  id: string;
  name: string;
  thumbnail?: string;
}

interface AppInfo {
  name: string;
  desc: string;
  icon: string;
  keyWords: string[];
  action: string;
}

interface AppBlock {
  id: string;
  appName: string;
  appPath: string;
  element: HTMLElement;
  videoStream?: MediaStream;
  isLaunched: boolean;
}

interface ElectronAPI {
  getSources: () => Promise<WindowSource[]>;
  getThumbnail: (id: string) => Promise<string | null>;
  getInstalledApps: () => Promise<AppInfo[]>;
  launchApp: (appPath: string) => Promise<any>;
  getIconDataUrl: (iconPath: string) => Promise<string>;
}

// 扩展Window接口以包含electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// DOM元素
const appsContainer = document.getElementById('apps-container');
const refreshAppsBtn = document.getElementById('refresh-apps-btn');
const toggleDrawerBtn = document.getElementById('toggle-drawer');
const appDrawer = document.getElementById('app-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const closeDrawerBtn = document.getElementById('close-drawer');
const canvasContent = document.getElementById('canvas-content');

// 工具栏元素
const toolbar = document.getElementById('toolbar');
const textToolBtn = document.getElementById('text-tool');
const rectToolBtn = document.getElementById('rect-tool');
const selectToolBtn = document.getElementById('select-tool');

// 抽屉状态
let isDrawerOpen = false;

// 工具栏状态
type ToolType = 'select' | 'text' | 'rect';
let currentTool: ToolType = 'select';

// 画布元素存储
const canvasElements: Map<string, HTMLElement> = new Map();
let nextElementId = 1;

// 画布状态
let canvasTransform = {
  x: 0,
  y: 0,
  scale: 1
};

// 拖拽状态
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

// 应用块存储
const appBlocks: Map<string, AppBlock> = new Map();
let nextBlockId = 1;
let nextBlockPosition = { x: 100, y: 100 };

// 切换工具
function switchTool(tool: ToolType) {
  currentTool = tool;
  
  // 更新工具按钮状态
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  if (tool === 'select') {
    selectToolBtn?.classList.add('active');
  } else if (tool === 'text') {
    textToolBtn?.classList.add('active');
  } else if (tool === 'rect') {
    rectToolBtn?.classList.add('active');
  }
  
  // 更新画布光标
  if (canvasContent) {
    if (tool === 'select') {
      canvasContent.style.cursor = 'default';
    } else if (tool === 'text') {
      canvasContent.style.cursor = 'text';
    } else if (tool === 'rect') {
      canvasContent.style.cursor = 'crosshair';
    }
  }
}

// 创建文字元素
function createTextElement(x: number, y: number) {
  if (!canvasContent) return;
  
  const elementId = `text-element-${nextElementId++}`;
  
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
  canvasElements.set(elementId, textElement);
  
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
}

// 创建矩形元素
function createRectElement(x: number, y: number) {
  if (!canvasContent) return;
  
  const elementId = `rect-element-${nextElementId++}`;
  
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
  canvasElements.set(elementId, rectElement);
  
  // 使元素可拖拽和可调整大小
  makeElementDraggable(rectElement);
  makeElementResizable(rectElement, resizeHandle);
}

// 使画布元素可拖拽
function makeElementDraggable(element: HTMLElement) {
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
function makeElementResizable(element: HTMLElement, handle: HTMLElement) {
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

// 打开抽屉
function openDrawer() {
  if (!appDrawer || !drawerOverlay) return;
  
  appDrawer.classList.add('open');
  drawerOverlay.classList.add('show');
  isDrawerOpen = true;
}

// 关闭抽屉
function closeDrawer() {
  if (!appDrawer || !drawerOverlay) return;
  
  appDrawer.classList.remove('open');
  drawerOverlay.classList.remove('show');
  isDrawerOpen = false;
}

// 切换抽屉状态
function toggleDrawer() {
  if (isDrawerOpen) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

// 加载已安装的应用
async function loadApps() {
  if (!appsContainer) return;
  
  appsContainer.innerHTML = '<p class="loading">正在加载应用列表...</p>';
  
  try {
    // 检查electronAPI是否可用
    if (!window.electronAPI) {
      throw new Error('electronAPI不可用，请检查preload脚本是否正确加载');
    }
    
    console.log('开始获取已安装应用...');
    const apps = await window.electronAPI.getInstalledApps();
    console.log('获取到的应用列表:', apps);
    
    if (apps.length === 0) {
      appsContainer.innerHTML = '<p>没有找到已安装的应用</p>';
      return;
    }
    
    // 创建应用列表
    appsContainer.innerHTML = '';
    
    for (const app of apps) {
      // 创建应用项
      const appItem = document.createElement('div');
      appItem.className = 'app-item';
      appItem.dataset.appPath = app.action;
      appItem.dataset.appName = app.name;
      
      // 创建应用图标
      const iconEl = document.createElement('img');
      iconEl.className = 'app-icon';
      iconEl.alt = app.name;
      
      // 使用API获取图标数据URL
      try {
        const iconDataUrl = await window.electronAPI.getIconDataUrl(app.icon);
        iconEl.src = iconDataUrl;
      } catch (error) {
        console.error(`获取应用 ${app.name} 图标失败:`, error);
        // 使用默认图标
        iconEl.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNjY2IiBkPSJNMTkgM0g1Yy0xLjEgMC0yIC45LTIgMnYxNGMwIDEuMS45IDIgMiAyaDE0YzEuMSAwIDItLjkgMi0yVjVjMC0xLjEtLjktMi0yLTJ6bTAgMTZINVY1aDE0djE0eiIvPjwvc3ZnPg==';
      }
      
      iconEl.onerror = () => {
        // 如果图标加载失败，使用默认图标
        iconEl.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNjY2IiBkPSJNMTkgM0g1Yy0xLjEgMC0yIC45LTIgMnYxNGMwIDEuMS45IDIgMiAyaDE0YzEuMSAwIDItLjkgMi0yVjVjMC0xLjEtLjktMi0yLTJ6bTAgMTZINVY1aDE0djE0eiIvPjwvc3ZnPg==';
      };
      
      // 创建应用名称
      const nameEl = document.createElement('p');
      nameEl.className = 'app-name';
      nameEl.textContent = app.name;
      
      // 组装元素
      appItem.appendChild(iconEl);
      appItem.appendChild(nameEl);
      
      // 添加点击事件，在画布上创建应用块
      appItem.addEventListener('click', () => createAppBlock(app.name, app.action));
      
      // 添加到容器
      appsContainer.appendChild(appItem);
    }
  } catch (error) {
    console.error('加载应用列表失败:', error);
    appsContainer.innerHTML = `<p>加载应用列表失败: ${error.message}</p>`;
  }
}

// 在画布上创建应用块
function createAppBlock(appName: string, appPath: string) {
  if (!canvasContent) return;
  
  const blockId = `app-block-${nextBlockId++}`;
  
  // 创建应用块元素
  const appBlock = document.createElement('div');
  appBlock.className = 'app-block';
  appBlock.id = blockId;
  appBlock.style.left = `${nextBlockPosition.x}px`;
  appBlock.style.top = `${nextBlockPosition.y}px`;
  
  // 创建头部
  const header = document.createElement('div');
  header.className = 'app-block-header';
  
  // 创建标题
  const title = document.createElement('div');
  title.className = 'app-block-title';
  title.textContent = appName;
  
  // 创建关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'app-block-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    removeAppBlock(blockId);
  });
  
  // 组装头部
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // 创建内容区域
  const content = document.createElement('div');
  content.className = 'app-block-content';
  
  // 创建占位符
  const placeholder = document.createElement('div');
  placeholder.className = 'app-block-placeholder';
  placeholder.textContent = '双击启动应用';
  
  content.appendChild(placeholder);
  
  // 组装应用块
  appBlock.appendChild(header);
  appBlock.appendChild(content);
  
  // 添加到画布
  canvasContent.appendChild(appBlock);
  
  // 存储应用块信息
  appBlocks.set(blockId, {
    id: blockId,
    appName,
    appPath,
    element: appBlock,
    isLaunched: false
  });
  
  // 添加拖拽功能
  makeBlockDraggable(appBlock);
  
  // 添加双击事件
  appBlock.addEventListener('dblclick', () => {
    // 如果应用已启动，先重置状态再重新启动
    const appBlockData = appBlocks.get(blockId);
    if (appBlockData && appBlockData.isLaunched) {
      resetAppBlock(blockId);
    }
    launchAppInBlock(blockId);
  });
  
  // 更新下一个应用块位置
  nextBlockPosition.x += 50;
  nextBlockPosition.y += 50;
  
  // 如果位置超出画布，重置位置
  if (nextBlockPosition.x > 2000) {
    nextBlockPosition.x = 100;
    nextBlockPosition.y += 50;
  }
  
  if (nextBlockPosition.y > 2000) {
    nextBlockPosition.x = 100;
    nextBlockPosition.y = 100;
  }
}

// 重置应用块状态
function resetAppBlock(blockId: string) {
  const appBlock = appBlocks.get(blockId);
  if (!appBlock) return;
  
  // 如果应用已启动，停止视频流
  if (appBlock.videoStream) {
    appBlock.videoStream.getTracks().forEach(track => track.stop());
    appBlock.videoStream = undefined;
  }
  
  // 重置应用块状态
  appBlock.isLaunched = false;
  
  // 重置应用块内容
  const content = appBlock.element.querySelector('.app-block-content') as HTMLElement;
  if (!content) return;
  
  // 清空内容
  content.innerHTML = '';
  
  // 创建占位符
  const placeholder = document.createElement('div');
  placeholder.className = 'app-block-placeholder';
  placeholder.textContent = '双击启动应用';
  
  content.appendChild(placeholder);
}

// 移除应用块
function removeAppBlock(blockId: string) {
  const appBlock = appBlocks.get(blockId);
  if (!appBlock) return;
  
  // 如果应用已启动，停止视频流
  if (appBlock.videoStream) {
    appBlock.videoStream.getTracks().forEach(track => track.stop());
  }
  
  // 从DOM中移除
  appBlock.element.remove();
  
  // 从存储中移除
  appBlocks.delete(blockId);
}

// 使应用块可拖拽和可调整大小
function makeBlockDraggable(element: HTMLElement) {
  let isDragging = false;
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let initialWidth = 0;
  let initialHeight = 0;
  let resizeDirection = '';
  
  const header = element.querySelector('.app-block-header') as HTMLElement;
  if (!header) return;
  
  // 拖拽功能
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;
    element.style.zIndex = '1000';
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到画布
  });
  
  // 调整大小功能
  element.addEventListener('mousedown', (e) => {
    const rect = element.getBoundingClientRect();
    const edgeThreshold = 10; // 边缘检测阈值
    
    // 检查是否在边缘
    const nearRightEdge = e.clientX - rect.left > rect.width - edgeThreshold;
    const nearBottomEdge = e.clientY - rect.top > rect.height - edgeThreshold;
    
    if (nearRightEdge && nearBottomEdge) {
      // 右下角
      resizeDirection = 'se';
    } else if (nearRightEdge) {
      // 右边
      resizeDirection = 'e';
    } else if (nearBottomEdge) {
      // 下边
      resizeDirection = 's';
    } else {
      return; // 不在边缘，不处理
    }
    
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    initialWidth = rect.width;
    initialHeight = rect.height;
    element.style.zIndex = '1000';
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到画布
  });
  
  // 鼠标移动时更新光标样式
  element.addEventListener('mousemove', (e) => {
    if (isDragging || isResizing) return;
    
    const rect = element.getBoundingClientRect();
    const edgeThreshold = 10;
    
    // 检查是否在边缘
    const nearRightEdge = e.clientX - rect.left > rect.width - edgeThreshold;
    const nearBottomEdge = e.clientY - rect.top > rect.height - edgeThreshold;
    
    // 设置光标样式
    if (nearRightEdge && nearBottomEdge) {
      element.style.cursor = 'se-resize';
    } else if (nearRightEdge) {
      element.style.cursor = 'e-resize';
    } else if (nearBottomEdge) {
      element.style.cursor = 's-resize';
    } else {
      element.style.cursor = 'default';
    }
  });
  
  // 鼠标离开时恢复光标
  element.addEventListener('mouseleave', () => {
    if (!isDragging && !isResizing) {
      element.style.cursor = 'default';
    }
  });
  
  // 全局鼠标移动事件
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      if (resizeDirection.includes('e')) {
        element.style.width = `${Math.max(200, initialWidth + dx)}px`; // 最小宽度200px
      }
      
      if (resizeDirection.includes('s')) {
        element.style.height = `${Math.max(150, initialHeight + dy)}px`; // 最小高度150px
      }
    }
  });
  
  // 全局鼠标释放事件
  document.addEventListener('mouseup', () => {
    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;
      element.style.zIndex = '';
      element.style.cursor = 'default';
    }
  });
}

// 在应用块中启动应用
async function launchAppInBlock(blockId: string) {
  const appBlock = appBlocks.get(blockId);
  if (!appBlock || appBlock.isLaunched) return;
  
  try {
    console.log(`正在启动应用: ${appBlock.appName} (${appBlock.appPath})`);
    
    // 启动应用
    await window.electronAPI.launchApp(appBlock.appPath);
    
    // 等待一段时间让应用启动
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 获取窗口源
    const sources = await window.electronAPI.getSources();
    
    // 查找匹配的窗口（这里简化处理，实际可能需要更复杂的匹配逻辑）
    const windowSource = sources.find(source => 
      source.name.toLowerCase().includes(appBlock.appName.toLowerCase())
    );
    
    if (!windowSource) {
      throw new Error(`未找到应用 ${appBlock.appName} 的窗口`);
    }
    
    // 获取媒体流
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: windowSource.id
        }
      }
    } as MediaStreamConstraints);
    
    // 更新应用块内容
    const content = appBlock.element.querySelector('.app-block-content') as HTMLElement;
    if (!content) return;
    
    // 清空内容
    content.innerHTML = '';
    
    // 创建视频元素
    const video = document.createElement('video');
    video.autoplay = true;
    video.srcObject = stream;
    
    // 监听视频流结束事件，当应用关闭时重置应用块状态
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      console.log(`应用 ${appBlock.appName} 已关闭，重置应用块状态`);
      resetAppBlock(blockId);
    });
    
    content.appendChild(video);
    
    // 更新应用块状态
    appBlock.videoStream = stream;
    appBlock.isLaunched = true;
    
    console.log(`应用 ${appBlock.appName} 启动成功，已捕获视频流`);
  } catch (error) {
    console.error(`启动应用 ${appBlock.appName} 失败:`, error);
    alert(`启动应用 ${appBlock.appName} 失败: ${error.message}`);
    
    // 启动失败时重置应用块状态
    resetAppBlock(blockId);
  }
}

// 初始化无限画布
function initInfiniteCanvas() {
  if (!canvasContent) return;
  
  const viewport = canvasContent.parentElement as HTMLElement;
  if (!viewport) return;
  
  // 鼠标按下事件
  viewport.addEventListener('mousedown', (e) => {
    // 检查是否点击了应用块或其子元素
    const target = e.target as HTMLElement;
    if (target.closest('.app-block') || target.closest('.canvas-element')) {
      return; // 如果点击了应用块或画布元素，不启动画布拖拽
    }
    
    // 如果当前工具不是选择工具，创建对应元素
    if (currentTool === 'text') {
      // 计算相对于画布内容的位置
      const rect = canvasContent.getBoundingClientRect();
      const x = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
      const y = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
      createTextElement(x, y);
      return;
    } else if (currentTool === 'rect') {
      // 计算相对于画布内容的位置
      const rect = canvasContent.getBoundingClientRect();
      const x = (e.clientX - rect.left - canvasTransform.x) / canvasTransform.scale;
      const y = (e.clientY - rect.top - canvasTransform.y) / canvasTransform.scale;
      createRectElement(x, y);
      return;
    }
    
    // 选择工具模式下，启动画布拖拽
    isDragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    dragOffset.x = canvasTransform.x;
    dragOffset.y = canvasTransform.y;
    canvasContent.classList.add('dragging');
    e.preventDefault();
  });
  
  // 鼠标移动事件
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    canvasTransform.x = dragOffset.x + dx;
    canvasTransform.y = dragOffset.y + dy;
    
    updateCanvasTransform();
  });
  
  // 鼠标释放事件
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      canvasContent.classList.remove('dragging');
    }
  });
  
  // 滚轮缩放事件
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = canvasTransform.scale * scaleFactor;
    
    // 限制缩放范围
    if (newScale < 0.1 || newScale > 3) return;
    
    // 计算缩放中心点
    const rect = viewport.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
    
    // 调整变换原点
    canvasTransform.x = centerX - (centerX - canvasTransform.x) * scaleFactor;
    canvasTransform.y = centerY - (centerY - canvasTransform.y) * scaleFactor;
    canvasTransform.scale = newScale;
    
    updateCanvasTransform();
  });
}

// 更新画布变换
function updateCanvasTransform() {
  if (!canvasContent) return;
  
  canvasContent.style.transform = `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`;
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 检查electronAPI是否可用
  console.log('electronAPI可用性:', !!window.electronAPI);
  console.log('window对象:', window);
  console.log('window.electronAPI:', window.electronAPI);
  
  // 添加一个延迟，确保preload脚本完全加载
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 再次检查electronAPI
  console.log('延迟后electronAPI可用性:', !!window.electronAPI);
  
  await loadApps();
  
  // 绑定刷新按钮事件
  refreshAppsBtn?.addEventListener('click', loadApps);
  
  // 绑定抽屉按钮事件
  toggleDrawerBtn?.addEventListener('click', toggleDrawer);
  drawerOverlay?.addEventListener('click', closeDrawer);
  closeDrawerBtn?.addEventListener('click', closeDrawer);
  
  // 绑定工具栏按钮事件
  textToolBtn?.addEventListener('click', () => switchTool('text'));
  rectToolBtn?.addEventListener('click', () => switchTool('rect'));
  selectToolBtn?.addEventListener('click', () => switchTool('select'));
  
  // 初始化无限画布
  initInfiniteCanvas();
});
