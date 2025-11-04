import './index.css';
import './toolbar/toolbar.css';
import { initToolbar, handleCanvasClick } from './toolbar';
import { initDrawer } from './drawer';
import { initWebDrawer } from './webdrawer/webdrawer';

// 定义类型
interface WindowSource {
  id: string;
  name: string;
  thumbnail?: string;
}

interface AppBlock {
  id: string;
  appName: string;
  appPath: string;
  element: HTMLElement;
  videoStream?: MediaStream;
  isLaunched: boolean;
  checkInterval?: NodeJS.Timeout;
}

interface WebBlock {
  id: string;
  url: string;
  element: HTMLElement;
  isLoaded: boolean;
}

interface ElectronAPI {
  getSources: () => Promise<WindowSource[]>;
  getAllWindows: () => Promise<WindowSource[]>;
  getThumbnail: (id: string) => Promise<string | null>;
  getStream: (id: string) => Promise<MediaStream>;
  getInstalledApps: () => Promise<any[]>;
  launchApp: (appPath: string) => Promise<any>;
  getIconDataUrl: (iconPath: string) => Promise<string>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  createWebWindow: (options: { url: string, blockId: string, width: number, height: number }) => Promise<{ success: boolean, viewId?: number, blockId?: string, error?: string }>;
  addWebViewToWindow: (blockId: string, x: number, y: number) => Promise<{ success: boolean, error?: string }>;
  removeWebViewFromWindow: (blockId: string) => Promise<{ success: boolean, error?: string }>;
  captureWebWindow: (blockId: string) => Promise<{ success: boolean, dataUrl?: string, error?: string }>;
  resizeWebWindow: (blockId: string, width: number, height: number) => Promise<{ success: boolean, error?: string }>;
  closeWebWindow: (blockId: string) => Promise<{ success: boolean, error?: string }>;
  navigateWebWindow: (blockId: string, url: string) => Promise<{ success: boolean, error?: string }>;
  getWebWindowUrl: (blockId: string) => Promise<{ success: boolean, url?: string, error?: string }>;
  clickWebWindow: (blockId: string, x: number, y: number) => Promise<{ success: boolean, error?: string }>;
  scrollWebWindow: (blockId: string, deltaX: number, deltaY: number) => Promise<{ success: boolean, error?: string }>;
  navigateWebWindowHistory: (blockId: string, direction: 'back' | 'forward') => Promise<{ success: boolean, error?: string }>;
  onWebPageLoaded?: (callback: (event: any, data: { blockId: string, success: boolean }) => void) => void;
  removeWebPageLoadedListener?: (callback: (event: any, data: { blockId: string, success: boolean }) => void) => void;
  onOpenLinkInNewBlock?: (callback: (event: any, data: { url: string }) => void) => void;
  removeOpenLinkInNewBlockListener?: (callback: (event: any, data: { url: string }) => void) => void;
}

// 扩展Window接口以包含electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// DOM元素
const canvasContent = document.getElementById('canvas-content');

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
const webBlocks: Map<string, WebBlock> = new Map();
let nextBlockId = 1;
let nextBlockPosition = { x: 100, y: 100 };

// 在画布上创建网页块
function createWebBlock(url: string) {
  if (!canvasContent) return;
  
  const blockId = `web-block-${nextBlockId++}`;
  
  // 创建网页块元素
  const webBlock = document.createElement('div');
  webBlock.className = 'app-block web-block';
  webBlock.id = blockId;
  webBlock.style.left = `${nextBlockPosition.x}px`;
  webBlock.style.top = `${nextBlockPosition.y}px`;
  
  // 创建头部
  const header = document.createElement('div');
  header.className = 'app-block-header web-block-header';
  
  // 创建标题
  const title = document.createElement('div');
  title.className = 'app-block-title';
  title.textContent = new URL(url).hostname;
  
  // 创建后退按钮
  const backBtn = document.createElement('button');
  backBtn.className = 'app-block-back';
  backBtn.innerHTML = '←';
  backBtn.title = '后退';
  backBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止触发拖拽
    window.electronAPI.navigateWebWindowHistory(blockId, 'back');
  });
  
  // 创建前进按钮
  const forwardBtn = document.createElement('button');
  forwardBtn.className = 'app-block-forward';
  forwardBtn.innerHTML = '→';
  forwardBtn.title = '前进';
  forwardBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止触发拖拽
    window.electronAPI.navigateWebWindowHistory(blockId, 'forward');
  });
  
  // 创建刷新按钮
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'app-block-refresh';
  refreshBtn.innerHTML = '↻';
  refreshBtn.title = '刷新网页';
  refreshBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止触发拖拽
    refreshWebPage(blockId);
  });
  
  // 创建在新窗口打开按钮
  const openWindowBtn = document.createElement('button');
  openWindowBtn.className = 'app-block-open-window';
  openWindowBtn.innerHTML = '⧉';
  openWindowBtn.title = '在新窗口中打开';
  openWindowBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 防止触发拖拽
    openWebPageInWindow(blockId);
  });
  
  // 创建关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'app-block-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    removeWebBlock(blockId);
  });
  
  // 组装头部
  header.appendChild(title);
  header.appendChild(backBtn);
  header.appendChild(forwardBtn);
  header.appendChild(refreshBtn);
  header.appendChild(openWindowBtn);
  header.appendChild(closeBtn);
  
  // 创建内容区域
  const content = document.createElement('div');
  content.className = 'app-block-content web-block-content';
  
  // 创建占位符
  const placeholder = document.createElement('div');
  placeholder.className = 'app-block-placeholder';
  placeholder.textContent = '正在加载网页...';
  
  content.appendChild(placeholder);
  
  // 组装网页块
  webBlock.appendChild(header);
  webBlock.appendChild(content);
  
  // 添加到画布
  canvasContent.appendChild(webBlock);
  
  // 存储网页块信息
  webBlocks.set(blockId, {
    id: blockId,
    url,
    element: webBlock,
    isLoaded: false
  });
  
  // 添加拖拽功能
  makeBlockDraggable(webBlock);
  
  // 加载网页
  loadWebPage(blockId);
  
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

// 加载网页
async function loadWebPage(blockId: string) {
  const webBlock = webBlocks.get(blockId);
  if (!webBlock) return;
  
  try {
    // 更新网页块内容
    const content = webBlock.element.querySelector('.app-block-content') as HTMLElement;
    if (!content) return;
    
    // 清空内容
    content.innerHTML = '';
    
    // 创建WebContentsView容器
    const webViewContainer = document.createElement('div');
    webViewContainer.className = 'web-view-container';
    webViewContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #f5f5f5;
    `;
    
    // 添加加载指示器
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'web-block-loading';
    loadingIndicator.innerHTML = '<div class="loading-spinner"></div><div style="margin-top: 10px;">正在加载网页...</div>';
    loadingIndicator.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
      background-color: rgba(255, 255, 255, 0.8);
    `;
    
    webViewContainer.appendChild(loadingIndicator);
    content.appendChild(webViewContainer);
    
    // 获取web-view-container的位置和大小
    const rect = webViewContainer.getBoundingClientRect();
    const mainWindowRect = document.body.getBoundingClientRect();
    const x = rect.left - mainWindowRect.left;
    const y = rect.top - mainWindowRect.top;
    const width = Math.floor(rect.width || 800);
    const height = Math.floor(rect.height || 600);
    
    console.log(`创建WebContentsView，blockId: ${blockId}, 尺寸: ${width}x${height}, 位置: (${x}, ${y})`);
    
    // 创建WebContentsView
    const result = await window.electronAPI.createWebWindow({
      url: webBlock.url,
      blockId: webBlock.id,
      width,
      height
    });
    
    if (result.success) {
      // 监听WebContentsView加载完成事件
      const handleWebPageLoaded = (event: any, data: { blockId: string }) => {
        if (data.blockId === blockId) {
          // 隐藏加载指示器
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }
          
          // 标记为已加载
          webBlock.isLoaded = true;
          
          // 移除事件监听器
          window.electronAPI.removeWebPageLoadedListener?.(handleWebPageLoaded);
        }
      };
      
      // 添加事件监听器
      window.electronAPI.onWebPageLoaded?.(handleWebPageLoaded);
      
      // 将WebContentsView添加到主窗口
      const addResult = await window.electronAPI.addWebViewToWindow(blockId, x, y);
      
      if (!addResult.success) {
        throw new Error(addResult.error || '添加网页视图到主窗口失败');
      }
      
      // 调整WebContentsView大小以匹配容器
      await window.electronAPI.resizeWebWindow(blockId, width, height);
      
      // 标记为已加载
      webBlock.isLoaded = true;
    } else {
      throw new Error(result.error || '创建网页视图失败');
    }
  } catch (error) {
    console.error(`加载网页 ${webBlock.url} 失败:`, error);
    
    // 显示错误信息
    const content = webBlock.element.querySelector('.app-block-content') as HTMLElement;
    if (content) {
      showWebError(content, webBlock.url, blockId, (error as Error).message);
    }
  }
}



// 显示网页错误
function showWebError(content: HTMLElement, url: string, blockId: string, errorMessage: string) {
  content.innerHTML = `
    <div class="web-error-container">
      <div class="web-error-icon">⚠️</div>
      <div class="web-error-title">加载失败</div>
      <div class="web-error-message">${errorMessage}</div>
      <button class="retry-btn" data-url="${url}" data-block-id="${blockId}">
        重试
      </button>
      <button class="open-external-btn" data-url="${url}" data-block-id="${blockId}">
        在外部浏览器中打开
      </button>
    </div>
  `;
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .web-error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 20px;
      text-align: center;
      color: #333;
    }
    .web-error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .web-error-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .web-error-message {
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
      max-width: 300px;
    }
    .retry-btn, .open-external-btn {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin: 5px;
      transition: background-color 0.2s;
    }
    .retry-btn:hover, .open-external-btn:hover {
      background-color: #2980b9;
    }
    .web-loading .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: #3498db;
      animation: spin 1s ease-in-out infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  
  // 添加样式到文档头部（如果还没有添加的话）
  if (!document.getElementById('web-error-style')) {
    style.id = 'web-error-style';
    document.head.appendChild(style);
  }
  
  // 绑定按钮点击事件
  const retryBtn = content.querySelector('.retry-btn') as HTMLButtonElement;
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      loadWebPage(blockId);
    });
  }
  
  const openBtn = content.querySelector('.open-external-btn') as HTMLButtonElement;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      // 使用electronAPI打开外部链接
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        // 如果electronAPI不可用，使用普通方式打开
        window.open(url, '_blank');
      }
    });
  }
}

// 显示CSP错误并提供在新窗口打开的选项
function showCspError(content: HTMLElement, url: string, blockId: string) {
  content.innerHTML = `
    <div class="csp-error-container">
      <div class="csp-error-icon">🔒</div>
      <div class="csp-error-title">无法在此窗口中显示</div>
      <div class="csp-error-message">
        该网站设置了安全策略，禁止在iframe中显示
      </div>
      <button class="open-external-btn" data-url="${url}" data-block-id="${blockId}">
        在新窗口中打开
      </button>
    </div>
  `;
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .csp-error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 20px;
      text-align: center;
      color: #333;
    }
    .csp-error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .csp-error-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .csp-error-message {
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
      max-width: 300px;
    }
    .open-external-btn {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    .open-external-btn:hover {
      background-color: #2980b9;
    }
  `;
  
  // 添加样式到文档头部（如果还没有添加的话）
  if (!document.getElementById('csp-error-style')) {
    style.id = 'csp-error-style';
    document.head.appendChild(style);
  }
  
  // 绑定按钮点击事件
  const openBtn = content.querySelector('.open-external-btn') as HTMLButtonElement;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      // 使用electronAPI打开外部链接
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        // 如果electronAPI不可用，使用普通方式打开
        window.open(url, '_blank');
      }
    });
  }
}

// 刷新网页
async function refreshWebPage(blockId: string) {
  const webBlock = webBlocks.get(blockId);
  if (!webBlock) return;
  
  try {
    // 获取当前URL
    const urlResult = await window.electronAPI.getWebWindowUrl(blockId);
    if (urlResult.success && urlResult.url) {
      // 导航到当前URL以刷新
      await window.electronAPI.navigateWebWindow(blockId, urlResult.url);
      console.log(`正在刷新网页: ${urlResult.url}`);
    }
  } catch (error) {
    console.error(`刷新网页失败:`, error);
  }
}

// 在新窗口中打开网页
async function openWebPageInWindow(blockId: string) {
  const webBlock = webBlocks.get(blockId);
  if (!webBlock) return;
  
  try {
    // 获取当前URL
    const urlResult = await window.electronAPI.getWebWindowUrl(blockId);
    if (urlResult.success && urlResult.url) {
      // 在外部浏览器中打开
      await window.electronAPI.openExternal(urlResult.url);
    }
  } catch (error) {
    console.error(`在新窗口中打开网页失败:`, error);
  }
}

// 移除网页块
async function removeWebBlock(blockId: string) {
  const webBlock = webBlocks.get(blockId);
  if (!webBlock) return;
  
  // 从主窗口移除WebContentsView
  try {
    await window.electronAPI.removeWebViewFromWindow(blockId);
  } catch (error) {
    console.error(`从主窗口移除网页视图失败:`, error);
  }
  
  // 关闭WebContentsView
  try {
    await window.electronAPI.closeWebWindow(blockId);
  } catch (error) {
    console.error(`关闭网页视图失败:`, error);
  }
  
  // 从DOM中移除
  webBlock.element.remove();
  
  // 从存储中移除
  webBlocks.delete(blockId);
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
  
  // 清除定期检查窗口状态的定时器
  if (appBlock.checkInterval) {
    clearInterval(appBlock.checkInterval);
    appBlock.checkInterval = undefined;
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
  
  // 清除定期检查窗口状态的定时器
  if (appBlock.checkInterval) {
    clearInterval(appBlock.checkInterval);
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
      
      // 如果是网页块，更新WebContentsView位置
      if (element.classList.contains('web-block')) {
        const blockId = element.id;
        const webBlock = webBlocks.get(blockId);
        if (webBlock && webBlock.isLoaded) {
          // 获取web-view-container的位置
          const webViewContainer = element.querySelector('.web-view-container') as HTMLElement;
          if (webViewContainer) {
            const rect = webViewContainer.getBoundingClientRect();
            const mainWindowRect = document.body.getBoundingClientRect();
            
            // 异步更新WebContentsView位置，避免阻塞UI
            window.electronAPI.addWebViewToWindow(
              blockId,
              rect.left - mainWindowRect.left,
              rect.top - mainWindowRect.top
            ).catch(error => console.error(`更新网页视图位置失败:`, error));
          }
        }
      }
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newWidth = initialWidth;
      let newHeight = initialHeight;
      
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(200, initialWidth + dx); // 最小宽度200px
      }
      
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(150, initialHeight + dy); // 最小高度150px
      }
      
      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
      
      // 如果是网页块，调整WebContentsView大小
      if (element.classList.contains('web-block')) {
        const blockId = element.id;
        const webBlock = webBlocks.get(blockId);
        if (webBlock && webBlock.isLoaded) {
          // 异步调整WebContentsView大小，避免阻塞UI
          window.electronAPI.resizeWebWindow(blockId, Math.floor(newWidth), Math.floor(newHeight))
            .catch(error => console.error(`调整网页视图大小失败:`, error));
        }
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
    
    // 获取启动前的窗口列表
    const sourcesBefore = await window.electronAPI.getSources();
    console.log(`启动前窗口数量: ${sourcesBefore.length}`);
    
    // 启动应用
    await window.electronAPI.launchApp(appBlock.appPath);
    
    // 等待一段时间让应用启动
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 获取启动后的窗口列表
    const sourcesAfter = await window.electronAPI.getSources();
    console.log(`启动后窗口数量: ${sourcesAfter.length}`);
    
    // 找出新增的窗口
    const newWindows = sourcesAfter.filter(sourceAfter => 
      !sourcesBefore.some(sourceBefore => sourceBefore.id === sourceAfter.id)
    );
    
    console.log(`新增窗口数量: ${newWindows.length}`);
    newWindows.forEach(window => {
      console.log(`- 新窗口: ${window.name} (ID: ${window.id})`);
    });
    
    // 如果没有新增窗口，尝试使用原来的匹配逻辑
    if (newWindows.length === 0) {
      console.log("未检测到新窗口，尝试使用应用名称匹配");
      
      // 从应用路径中提取可执行文件名（不含扩展名）
      const pathParts = appBlock.appPath.split(/[/\\]/);
      const exeFileName = pathParts[pathParts.length - 1];
      const exeNameWithoutExt = exeFileName.replace(/\.[^.]+$/, '');
      
      // 查找匹配的窗口，优先使用可执行文件名匹配
      let windowSource = sourcesAfter.find(source => 
        source.name.toLowerCase().includes(exeNameWithoutExt.toLowerCase())
      );
      
      // 如果没有找到，尝试使用完整可执行文件名匹配
      if (!windowSource) {
        windowSource = sourcesAfter.find(source => 
          source.name.toLowerCase().includes(exeFileName.toLowerCase())
        );
      }
      
      // 如果仍然没有找到，尝试使用应用名称匹配（作为后备方案）
      if (!windowSource) {
        windowSource = sourcesAfter.find(source => 
          source.name.toLowerCase().includes(appBlock.appName.toLowerCase())
        );
      }
      
      if (!windowSource) {
        throw new Error(`未找到应用 ${appBlock.appName} 的窗口`);
      }
      
      // 使用找到的窗口源
      const windowSourceId = windowSource.id;
      processWindowStream(windowSourceId, appBlock, blockId);
    } else {
      // 使用第一个新增窗口
      const newWindow = newWindows[0];
      console.log(`使用新窗口: ${newWindow.name} (ID: ${newWindow.id})`);
      processWindowStream(newWindow.id, appBlock, blockId);
    }
  } catch (error) {
    console.error(`启动应用 ${appBlock.appName} 失败:`, error);
    alert(`启动应用 ${appBlock.appName} 失败: ${(error as Error).message}`);
    
    // 启动失败时重置应用块状态
    resetAppBlock(blockId);
  }
}

// 处理窗口流的辅助函数
async function processWindowStream(windowSourceId: string, appBlock: AppBlock, blockId: string) {
  try {
    // 获取媒体流
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: windowSourceId
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
    
    // 添加定期检查窗口状态的机制
    const checkInterval = setInterval(async () => {
      try {
        // 获取当前所有窗口
        const currentWindows = await window.electronAPI.getAllWindows();
        
        // 检查我们捕获的窗口是否还存在
        const windowExists = currentWindows.some(win => win.id === windowSourceId);
        
        // 如果窗口不存在且应用块仍然标记为已启动，则重置应用块状态
        if (!windowExists && appBlock.isLaunched) {
          console.log(`检测到应用 ${appBlock.appName} 窗口已关闭，重置应用块状态`);
          clearInterval(checkInterval);
          resetAppBlock(blockId);
        }
      } catch (error) {
        console.error('检查窗口状态时出错:', error);
      }
    }, 2000); // 每2秒检查一次
    
    // 将检查间隔ID存储到应用块中，以便在重置时清除
    appBlock.checkInterval = checkInterval;
    
    console.log(`应用 ${appBlock.appName} 启动成功，已捕获视频流`);
  } catch (error) {
    console.error(`处理应用 ${appBlock.appName} 窗口流失败:`, error);
    alert(`处理应用 ${appBlock.appName} 窗口流失败: ${(error as Error).message}`);
    
    // 处理失败时重置应用块状态
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
    
    // 使用工具栏模块处理画布点击
    const handled = handleCanvasClick(e, canvasContent, canvasTransform);
    if (handled) {
      return; // 如果工具栏模块已处理事件，不继续
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

// 节流函数，限制函数执行频率
function throttle<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;
  
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  }) as T;
}

// 更新画布变换
const updateCanvasTransform = throttle(() => {
  if (!canvasContent) return;
  
  canvasContent.style.transform = `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`;
  
  // 更新所有WebContentsView的位置和大小
  webBlocks.forEach((webBlock) => {
    if (webBlock.isLoaded) {
      const element = webBlock.element;
      const webViewContainer = element.querySelector('.web-view-container') as HTMLElement;
      
      if (webViewContainer) {
        // 获取元素在变换后的实际位置
        const rect = webViewContainer.getBoundingClientRect();
        const mainWindowRect = document.body.getBoundingClientRect();
        
        // 计算变换后的实际位置和大小
        const actualX = rect.left - mainWindowRect.left;
        const actualY = rect.top - mainWindowRect.top;
        const actualWidth = rect.width;
        const actualHeight = rect.height;
        
        // 异步更新WebContentsView位置和大小
        window.electronAPI.addWebViewToWindow(
          webBlock.id,
          Math.floor(actualX),
          Math.floor(actualY)
        ).catch(error => console.error(`更新网页视图位置失败:`, error));
        
        window.electronAPI.resizeWebWindow(
          webBlock.id,
          Math.floor(actualWidth),
          Math.floor(actualHeight)
        ).catch(error => console.error(`更新网页视图大小失败:`, error));
      }
    }
  });
}, 16); // 约60fps的更新频率

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
  
  // 初始化应用抽屉
  initDrawer(
    (appName: string, appPath: string) => {
      createAppBlock(appName, appPath);
    }
  );
  
  // 初始化网页抽屉
  initWebDrawer(
    (url: string) => {
      createWebBlock(url);
    }
  );
  
  // 初始化工具栏
  initToolbar(canvasContent);
  
  // 初始化无限画布
  initInfiniteCanvas();
  
  // 监听主进程发送的打开新链接请求
  if (window.electronAPI && window.electronAPI.onOpenLinkInNewBlock) {
    window.electronAPI.onOpenLinkInNewBlock((event, { url }) => {
      console.log('收到打开新链接请求:', url);
      createWebBlock(url);
    });
  }
});