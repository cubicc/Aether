import { app, BrowserWindow, ipcMain, desktopCapturer, shell, WebContentsView } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import started from 'electron-squirrel-startup';

// 确保应用在后台时继续运行
app.commandLine.appendSwitch('disable-backgrounding');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // 添加必要的权限
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false, // 禁用后台节流，确保最小化时继续运行
      // 允许webview标签
      webviewTag: true,
      // 允许加载更多内容
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      // 添加更多webview相关权限
      plugins: true,
      javascript: true,
      images: true,
      // 设置更宽松的CSP
      additionalArguments: [
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-site-isolation-trials',
        '--disable-features=CrossSiteDocumentBlockingIfIsolating',
        '--disable-features=CrossSiteDocumentBlockingAlways',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    },
    // 确保窗口在后台时继续运行
    show: true,
  });

  // 创建一个独立的会话，用于处理webview
  const session = mainWindow.webContents.session;
  
  // 设置会话的安全策略
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:; script-src * \'unsafe-inline\' \'unsafe-eval\'; connect-src * \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\'; frame-src *; style-src * \'unsafe-inline\';'],
        'X-Frame-Options': ['ALLOWALL'],
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type, Authorization']
      }
    });
  });

  // 防止窗口最小化时暂停渲染
  mainWindow.on('minimize', () => {
    // 保持窗口在后台运行
    mainWindow.webContents.setBackgroundThrottling(false);
  });

  // 窗口恢复时恢复正常状态
  mainWindow.on('restore', () => {
    mainWindow.webContents.setBackgroundThrottling(true);
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// 获取所有可用窗口源
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  return sources;
});

// 获取所有窗口
ipcMain.handle('get-all-windows', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window'] });
  return sources;
});

// 获取指定窗口的缩略图
ipcMain.handle('get-thumbnail', async (event, id: string) => {
  const sources = await desktopCapturer.getSources({ 
    types: ['window', 'screen'],
    thumbnailSize: { width: 300, height: 200 }
  });
  
  const source = sources.find(s => s.id === id);
  if (source && source.thumbnail) {
    // 将缩略图转换为数据URL
    return source.thumbnail.toDataURL();
  }
  return null;
});

// 获取指定窗口的媒体流
ipcMain.handle('get-stream', async (event, id: string) => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  const source = sources.find(s => s.id === id);
  
  if (source) {
    // 直接返回源信息，让渲染进程使用
    return {
      id: source.id,
      name: source.name
    };
  }
  
  throw new Error(`未找到ID为 ${id} 的窗口`);
});

// 获取已安装的应用列表
ipcMain.handle('get-installed-apps', async () => {
  const filePath = path.resolve(
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
  );
  
  const appData = path.join(os.homedir(), './AppData/Roaming');
  const startMenu = path.join(
    appData,
    'Microsoft\\Windows\\Start Menu\\Programs'
  );
  
  const fileLists: any[] = [];
  const isZhRegex = /[\u4e00-\u9fa5]/;
  
  // 创建图标目录
  const icondir = path.join(os.tmpdir(), 'ProcessIcon');
  if (!fs.existsSync(icondir)) {
    fs.mkdirSync(icondir);
  }
  
  // 递归读取目录中的文件
  const fileDisplay = (dirPath: string): void => {
    try {
      const files = fs.readdirSync(dirPath);
      
      files.forEach((filename) => {
        const filedir = path.join(dirPath, filename);
        
        try {
          const stats = fs.statSync(filedir);
          const isFile = stats.isFile();
          const isDir = stats.isDirectory();
          
          if (isFile) {
            const appName = filename.split('.')[0];
            const keyWords = [appName];
            let appDetail: any = {};
            
            try {
              appDetail = shell.readShortcutLink(filedir);
            } catch (e) {
              // 忽略无法读取的快捷方式
            }
            
            if (!appDetail.target || appDetail.target.toLowerCase().indexOf('unin') >= 0) {
              return;
            }
            
            // 获取应用程序名称
            keyWords.push(path.basename(appDetail.target, '.exe'));
            
            if (isZhRegex.test(appName)) {
              // 中文应用名称处理
            } else {
              const firstLatter = appName
                .split(' ')
                .map((name) => name[0])
                .join('');
              keyWords.push(firstLatter);
            }
            
            // 尝试提取应用图标
            let icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNjY2IiBkPSJNMTkgM0g1Yy0xLjEgMC0yIC45LTIgMnYxNGMwIDEuMS45IDIgMiAyaDE0YzEuMSAwIDItLjkgMi0yVjVjMC0xLjEtLjktMi0yLTJ6bTAgMTZINVY1aDE0djE0eiIvPjwvc3ZnPg==';
            
            try {
              if (fs.existsSync(appDetail.target)) {
                const iconPath = path.join(
                  icondir,
                  `${encodeURIComponent(appName)}.png`
                );
                
                // 如果图标文件不存在，尝试提取
                if (!fs.existsSync(iconPath)) {
                  try {
                    // 使用 extract-file-icon 库提取图标
                    const fileIcon = require('extract-file-icon');
                    const buffer = fileIcon(appDetail.target, 32);
                    
                    if (buffer && buffer.length > 0) {
                      fs.writeFileSync(iconPath, buffer);
                      icon = iconPath;
                    }
                  } catch (error) {
                    console.error(`提取应用 ${appName} 图标失败:`, error);
                  }
                } else {
                  // 图标文件已存在
                  icon = iconPath;
                }
              }
            } catch (error) {
              console.error(`处理应用 ${appName} 图标时出错:`, error);
            }
            
            const appInfo = {
              name: appName,
              desc: appDetail.target,
              icon,
              keyWords,
              action: appDetail.target,
            };
            
            fileLists.push(appInfo);
          }
          
          if (isDir) {
            fileDisplay(filedir); // 递归处理子目录
          }
        } catch (err) {
          // 忽略无法访问的文件或目录
        }
      });
    } catch (err) {
      console.error(`读取目录失败: ${dirPath}`, err);
    }
  };
  
  // 读取两个目录
  fileDisplay(filePath);
  fileDisplay(startMenu);
  
  return fileLists;
});

// 启动应用程序
ipcMain.handle('launch-app', async (event, appPath: string) => {
  return new Promise((resolve, reject) => {
    // 使用spawn而不是exec，这样不会等待应用程序退出
    const { spawn } = require('child_process');
    
    // 在Windows上，对于GUI应用程序，我们需要使用start命令来启动它们
    // 这样可以确保应用程序启动后立即返回，而不等待应用程序退出
    const isWindows = process.platform === 'win32';
    let command, args;
    
    if (isWindows) {
      // 在Windows上使用start命令启动GUI应用程序
      command = 'cmd';
      args = ['/c', 'start', '', '""', `"${appPath}"`];
    } else {
      // 在其他平台上直接使用应用程序路径
      command = appPath;
      args = [];
    }
    
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      shell: true
    });
    
    // 不等待子进程退出，立即返回
    child.unref();
    
    // 给应用程序一点时间启动
    setTimeout(() => {
      resolve({ success: true });
    }, 500);
  });
});

// 在外部浏览器中打开链接
ipcMain.handle('open-external', async (event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error(`打开外部链接失败: ${url}`, error);
    return { success: false, error: (error as Error).message };
  }
});

// 存储所有网页视图的映射
const webViews = new Map<string, WebContentsView>();

// 创建网页视图
ipcMain.handle('create-web-window', async (event, options: { url: string, blockId: string, width: number, height: number }) => {
  try {
    // 如果已存在该blockId的视图，先销毁它
    if (webViews.has(options.blockId)) {
      const existingView = webViews.get(options.blockId);
      if (existingView) {
        // 从主窗口移除视图（如果已添加）
        const mainWindow = BrowserWindow.fromWebContents(event.sender);
        if (mainWindow) {
          mainWindow.contentView.removeChildView(existingView);
        }
        existingView.webContents.close();
      }
      webViews.delete(options.blockId);
    }
    
    // 创建新的WebContentsView
    const webView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // 允许跨域资源加载
        sandbox: false,
        // 添加以下配置以确保CSS正确渲染
        plugins: true,
        images: true,
        javascript: true,
        webgl: true,
        webaudio: true,
        // 允许加载本地资源
        allowRunningInsecureContent: true,
        // 启用实验性功能
        experimentalFeatures: true,
        // 启用更多渲染功能
        enableRemoteModule: true,
        // 禁用同源策略以解决资源加载问题
        webSecurity: false,
        // 设置用户代理
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        // 添加额外的渲染选项
        preload: path.join(__dirname, 'preload.js'),
        // 启用硬件加速
        offscreen: false
      }
    });
    
    // 设置视图大小
    webView.setBounds({
      x: 0,
      y: 0,
      width: options.width || 800,
      height: options.height || 600
    });
    
    // 存储视图引用
    webViews.set(options.blockId, webView);
    
    // 加载URL
    await webView.webContents.loadURL(options.url);
    
    // 监听页面标题变化
    webView.webContents.on('page-title-updated', (event, title) => {
      // 通知渲染进程标题已变化
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('web-window-title-updated', { blockId: options.blockId, title });
      }
    });
    
    // 拦截新窗口创建事件
    webView.webContents.setWindowOpenHandler(({ url }) => {
      // 阻止新窗口创建，改为在应用内打开新链接
      // 获取主窗口
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow && mainWindow.webContents) {
        // 通知渲染进程创建新的block来加载链接
        mainWindow.webContents.send('open-link-in-new-block', { url });
      }
      return { action: 'deny' };
    });
    
    // 拦截导航事件，处理target="_blank"的链接
    webView.webContents.on('will-navigate', (event, navigationUrl) => {
      // 如果是外部链接且不是当前域名，则在应用内打开新block
      try {
        const currentUrl = webView.webContents.getURL();
        if (!currentUrl) return; // 如果没有当前URL，则不处理
        
        const currentDomain = new URL(currentUrl).hostname;
        const navigationDomain = new URL(navigationUrl).hostname;
        
        if (currentDomain !== navigationDomain) {
          event.preventDefault();
          // 获取主窗口
          const mainWindow = BrowserWindow.getAllWindows()[0];
          if (mainWindow && mainWindow.webContents) {
            // 通知渲染进程创建新的block来加载链接
            mainWindow.webContents.send('open-link-in-new-block', { url: navigationUrl });
          }
        }
      } catch (error) {
        // 如果URL解析失败，则不处理
        console.error('处理导航事件时出错:', error);
      }
    });
    
    return { 
      success: true, 
      viewId: webView.webContents.id,
      blockId: options.blockId
    };
  } catch (error) {
    console.error(`创建网页视图失败:`, error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
});

// 将WebContentsView添加到主窗口
ipcMain.handle('add-web-view-to-window', async (event, blockId: string, x: number, y: number) => {
  try {
    const webView = webViews.get(blockId);
    if (!webView) {
      return { success: false, error: '视图不存在' };
    }
    
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) {
      return { success: false, error: '无法获取主窗口' };
    }
    
    // 更新视图位置
    const currentBounds = webView.getBounds();
    const newX = Number.isFinite(x) ? x : 0;
    const newY = Number.isFinite(y) ? y : 0;
    const newWidth = Number.isFinite(currentBounds.width) ? currentBounds.width : 800;
    const newHeight = Number.isFinite(currentBounds.height) ? currentBounds.height : 600;
    
    webView.setBounds({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    });
    
    // 使用WebContentsView的API添加视图
    mainWindow.contentView.addChildView(webView);
    
    // 给视图焦点
    webView.webContents.focus();
    
    // 检查是否已经有监听器，避免重复添加
    if (!webView.webContents.listenerCount('did-finish-load')) {
      // 监听页面加载完成事件
      webView.webContents.on('did-finish-load', () => {
        // 注入CSS样式，确保网页正确渲染
        webView.webContents.insertCSS(`
          /* 重置基础样式，但不强制所有元素 */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: visible !important;
          }
          
          /* 确保常见的布局元素正确显示 */
          div, section, article, main, aside, header, footer, nav {
            display: block !important;
          }
          
          /* 确保背景色和文字颜色正确显示 */
          body {
            background-color: #ffffff !important;
            color: #24292e !important;
          }
          
          /* 确保链接样式正确 */
          a {
            color: #0366d6 !important;
            text-decoration: none !important;
          }
          
          a:hover {
            text-decoration: underline !important;
          }
        `);
        
        // 延迟注入更多样式，确保页面完全加载
        setTimeout(() => {
          webView.webContents.insertCSS(`
            /* GitHub特定样式修复 */
            .application-main {
              min-height: 100vh !important;
            }
            
            /* 确保flex布局正确显示 */
            .d-flex, .flex-column, .flex-row {
              display: flex !important;
            }
            
            /* 确保grid布局正确显示 */
            .d-grid {
              display: grid !important;
            }
            
            /* 确保常见框架的样式正确 */
            [data-testid], [data-reactroot] {
              display: block !important;
            }
          `);
        }, 1000);
        
        // 通知渲染进程页面已加载完成
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('web-page-loaded', { blockId });
        }
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error(`添加网页视图到主窗口失败:`, error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
});

// 从主窗口移除WebContentsView
ipcMain.handle('remove-web-view-from-window', async (event, blockId: string) => {
  try {
    const webView = webViews.get(blockId);
    if (!webView) {
      return { success: false, error: '视图不存在' };
    }
    
    // 获取主窗口
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) {
      return { success: false, error: '无法获取主窗口' };
    }
    
    // 从主窗口移除视图
    mainWindow.contentView.removeChildView(webView);
    
    return { success: true };
  } catch (error) {
    console.error(`从主窗口移除网页视图失败:`, error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
});

// 获取网页视图的截图
ipcMain.handle('capture-web-window', async (event, blockId: string) => {
  try {
    const webView = webViews.get(blockId);
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    // 截取WebContentsView的图像
    const image = await webView.webContents.capturePage();
    const dataUrl = image.toDataURL();
    
    return { 
      success: true, 
      dataUrl 
    };
  } catch (error) {
    console.error('截取WebContentsView失败:', error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
});

// 调整WebContentsView的大小
ipcMain.handle('resize-web-window', async (event, blockId: string, width: number, height: number) => {
  try {
    const webView = webViews.get(blockId);
    
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    // 获取当前位置
    const currentBounds = webView.getBounds();
    
    // 更新大小，保持位置不变
    webView.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width,
      height
    });
    
    return { success: true };
  } catch (error) {
    console.error('调整WebContentsView大小失败:', error);
    return { success: false, error: (error as Error).message };
  }
});

// 关闭WebContentsView
ipcMain.handle('close-web-window', async (event, blockId: string) => {
  try {
    const webView = webViews.get(blockId);
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    // 从主窗口移除WebContentsView
    if (mainWindow) {
      mainWindow.contentView.removeChildView(webView);
    }
    
    // 销毁WebContentsView
    webView.webContents.close();
    
    // 从映射中移除
    webViews.delete(blockId);
    
    return { success: true };
  } catch (error) {
    console.error('关闭WebContentsView失败:', error);
    return { success: false, error: (error as Error).message };
  }
});

// 在网页视图中导航到新URL
ipcMain.handle('navigate-web-window', async (event, blockId: string, url: string) => {
  try {
    const webView = webViews.get(blockId);
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    await webView.webContents.loadURL(url);
    return { success: true };
  } catch (error) {
    console.error('导航WebContentsView失败:', error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
});

// 获取WebContentsView当前URL
ipcMain.handle('get-web-window-url', async (event, blockId: string) => {
  try {
    const webView = webViews.get(blockId);
    
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    // 获取当前URL
    const url = webView.webContents.getURL();
    
    return { success: true, data: { url } };
  } catch (error) {
    console.error('获取WebContentsView URL失败:', error);
    return { success: false, error: (error as Error).message };
  }
});

// 在WebContentsView中模拟点击
ipcMain.handle('click-web-window', async (event, blockId: string, x: number, y: number) => {
  try {
    const webView = webViews.get(blockId);
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    // 在WebContentsView中模拟点击
    webView.webContents.sendInputEvent({
      type: 'mouseDown',
      x: Math.floor(x),
      y: Math.floor(y),
      button: 'left',
      clickCount: 1
    });
    
    webView.webContents.sendInputEvent({
      type: 'mouseUp',
      x: Math.floor(x),
      y: Math.floor(y),
      button: 'left',
      clickCount: 1
    });
    
    return { success: true };
  } catch (error) {
    console.error('点击WebContentsView失败:', error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
});

// 在网页视图中模拟滚动
ipcMain.handle('scroll-web-window', async (event, blockId: string, deltaX: number, deltaY: number) => {
  try {
    const webView = webViews.get(blockId);
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    // 在WebContentsView中模拟滚动
    webView.webContents.sendInputEvent({
      type: 'mouseWheel',
      x: 0,
      y: 0,
      deltaX: -deltaX, // Electron中的deltaX/deltaY方向与DOM事件相反
      deltaY: -deltaY,
      canScroll: true,
      hasPreciseScrollingDeltas: true
    });
    
    return { success: true };
  } catch (error) {
    console.error('滚动WebContentsView失败:', error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
});

// 在网页视图中导航（前进或后退）
ipcMain.handle('navigate-web-window-history', async (event, blockId: string, direction: 'back' | 'forward') => {
  try {
    const webView = webViews.get(blockId);
    
    if (!webView) {
      return { success: false, error: '找不到WebContentsView' };
    }
    
    // 导航历史
    if (direction === 'back') {
      if (webView.webContents.canGoBack()) {
        webView.webContents.goBack();
      } else {
        return { success: false, error: '无法后退' };
      }
    } else if (direction === 'forward') {
      if (webView.webContents.canGoForward()) {
        webView.webContents.goForward();
      } else {
        return { success: false, error: '无法前进' };
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('导航WebContentsView历史失败:', error);
    return { success: false, error: (error as Error).message };
  }
});

// 应用退出时关闭所有网页视图
app.on('before-quit', () => {
  for (const [blockId, webView] of webViews) {
    if (webView) {
      webView.webContents.close();
    }
  }
  webViews.clear();
});
