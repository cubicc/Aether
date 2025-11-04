// 抽屉模块类型定义

export interface AppInfo {
  name: string;
  desc: string;
  icon: string;
  keyWords: string[];
  action: string;
}

export interface ElectronAPI {
  getSources: () => Promise<any[]>;
  getThumbnail: (id: string) => Promise<string | null>;
  getInstalledApps: () => Promise<AppInfo[]>;
  launchApp: (appPath: string) => Promise<any>;
  getIconDataUrl: (iconPath: string) => Promise<string>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
}

export interface DrawerState {
  isOpen: boolean;
}

export interface AppItem {
  name: string;
  path: string;
  icon: string;
  element?: HTMLElement;
}