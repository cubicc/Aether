import { app, BrowserWindow, ipcMain, desktopCapturer, shell } from 'electron';
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
    },
    // 确保窗口在后台时继续运行
    show: true,
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
    exec(`"${appPath}"`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
});
