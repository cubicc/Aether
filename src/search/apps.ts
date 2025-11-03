import fs from 'fs';
import path from 'path';
import os from 'os';

// 定义应用信息接口
export interface AppInfo {
  name: string;
  desc: string;
  icon: string;
  keyWords: string[];
  action: string;
}

// 获取已安装的应用列表
export const getInstalledApps = (): AppInfo[] => {
  const filePath = path.resolve(
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
  );
  
  const appData = path.join(os.homedir(), './AppData/Roaming');
  const startMenu = path.join(
    appData,
    'Microsoft\\Windows\\Start Menu\\Programs'
  );
  
  const fileLists: AppInfo[] = [];
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
              // 这里不能直接使用shell.readShortcutLink，因为它只能在主进程中使用
              // 我们将在主进程中处理这部分逻辑
            } catch (e) {
              // 忽略无法读取的快捷方式
            }
            
            if (isZhRegex.test(appName)) {
              // 中文应用名称处理
            } else {
              const firstLatter = appName
                .split(' ')
                .map((name) => name[0])
                .join('');
              keyWords.push(firstLatter);
            }
            
            const icon = path.join(
              os.tmpdir(),
              'ProcessIcon',
              `${encodeURIComponent(appName)}.png`
            );
            
            const appInfo: AppInfo = {
              name: appName,
              desc: '', // 将在主进程中填充
              icon,
              keyWords,
              action: '', // 将在主进程中填充
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
};