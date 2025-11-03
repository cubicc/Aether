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
          // 文件不存在，返回默认图标
          resolve('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNjY2IiBkPSJNMTkgM0g1Yy0xLjEgMC0yIC45LTIgMnYxNGMwIDEuMS45IDIgMiAyaDE0YzEuMSAwIDItLjkgMi0yVjVjMC0xLjEtLjktMi0yLTJ6bTAgMTZINVY1aDE0djE0eiIvPjwvc3ZnPg==');
        }
      } catch (error) {
        reject(error);
      }
    });
  }
});
