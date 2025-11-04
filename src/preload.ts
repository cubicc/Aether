import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';

// 定义应用信息接口
interface AppInfo {
  name: string;
  desc: string;
  icon: string;
  keyWords: string[];
  action: string;
}

// 暴露受保护的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取所有可用窗口源
  getSources: () => ipcRenderer.invoke('get-sources'),
  
  // 获取所有窗口
  getAllWindows: () => ipcRenderer.invoke('get-all-windows'),
  
  // 获取指定窗口的缩略图
  getThumbnail: (id: string) => ipcRenderer.invoke('get-thumbnail', id),
  
  // 获取指定窗口的媒体流
  getStream: (id: string) => ipcRenderer.invoke('get-stream', id),
  
  // 获取已安装的应用列表
  getInstalledApps: () => ipcRenderer.invoke('get-installed-apps'),
  
  // 启动应用程序
  launchApp: (appPath: string) => ipcRenderer.invoke('launch-app', appPath),
  
  // 将图标文件转换为数据URL
  getIconDataUrl: (iconPath: string) => {
    return new Promise((resolve, reject) => {
      try {
        // 如果是数据URL，直接返回
        if (iconPath.startsWith('data:')) {
          resolve(iconPath);
          return;
        }
        
        // 如果是文件路径，读取文件并转换为数据URL
        if (fs.existsSync(iconPath)) {
          const iconData = fs.readFileSync(iconPath);
          const ext = path.extname(iconPath).toLowerCase();
          let mimeType = 'image/png';
          
          if (ext === '.ico') {
            mimeType = 'image/x-icon';
          } else if (ext === '.jpg' || ext === '.jpeg') {
            mimeType = 'image/jpeg';
          }
          
          const dataUrl = `data:${mimeType};base64,${iconData.toString('base64')}`;
          resolve(dataUrl);
        } else {
          reject(new Error('图标文件不存在'));
        }
      } catch (error) {
        reject(error);
      }
    });
  },
  
  // 在外部浏览器中打开链接
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // 创建新的WebContentsView用于加载网页
  createWebWindow: (options: { url: string, blockId: string, width: number, height: number }) => ipcRenderer.invoke('create-web-window', options),
  
  // 将WebContentsView添加到主窗口
  addWebViewToWindow: (blockId: string, x: number, y: number) => ipcRenderer.invoke('add-web-view-to-window', blockId, x, y),
  
  // 从主窗口移除WebContentsView
  removeWebViewFromWindow: (blockId: string) => ipcRenderer.invoke('remove-web-view-from-window', blockId),
  
  // 截取WebContentsView的预览图
  captureWebWindow: (blockId: string) => ipcRenderer.invoke('capture-web-window', blockId),
  
  // 调整WebContentsView的大小
  resizeWebWindow: (blockId: string, width: number, height: number) => ipcRenderer.invoke('resize-web-window', blockId, width, height),
  
  // 关闭WebContentsView
  closeWebWindow: (blockId: string) => ipcRenderer.invoke('close-web-window', blockId),
  
  // 导航到新的URL
  navigateWebWindow: (blockId: string, url: string) => ipcRenderer.invoke('navigate-web-window', blockId, url),
  
  // 获取WebContentsView当前URL
  getWebWindowUrl: (blockId: string) => ipcRenderer.invoke('get-web-window-url', blockId),
  
  // 在网页视图中模拟点击
  clickWebWindow: (blockId: string, x: number, y: number) => ipcRenderer.invoke('click-web-window', blockId, x, y),
  
  // 在网页视图中模拟滚动
  scrollWebWindow: (blockId: string, deltaX: number, deltaY: number) => ipcRenderer.invoke('scroll-web-window', blockId, deltaX, deltaY),
  
  // 在网页视图中导航（前进或后退）
  navigateWebWindowHistory: (blockId: string, direction: 'back' | 'forward') => ipcRenderer.invoke('navigate-web-window-history', blockId, direction),
  
  // 监听网页加载完成事件
  onWebPageLoaded: (callback: (event: any, data: { blockId: string }) => void) => {
    ipcRenderer.on('web-page-loaded', callback);
  },
  
  // 移除网页加载完成事件监听器
  removeWebPageLoadedListener: (callback: (event: any, data: { blockId: string }) => void) => {
    ipcRenderer.removeListener('web-page-loaded', callback);
  },
  
  // 监听主进程发送的打开新链接请求
  onOpenLinkInNewBlock: (callback: (event: any, data: { url: string }) => void) => {
    ipcRenderer.on('open-link-in-new-block', callback);
  },
  
  // 移除打开新链接请求监听器
  removeOpenLinkInNewBlockListener: (callback: (event: any, data: { url: string }) => void) => {
    ipcRenderer.removeListener('open-link-in-new-block', callback);
  }
});
