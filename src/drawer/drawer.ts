import { AppInfo, DrawerState, ElectronAPI } from './types';
import { 
  createAppItem, 
  showLoadingState, 
  showErrorState, 
  showEmptyState, 
  clearAppContainer 
} from './ui';

// DOM元素
let appsContainer: HTMLElement | null = null;
let refreshAppsBtn: HTMLElement | null = null;
let toggleDrawerBtn: HTMLElement | null = null;
let appDrawer: HTMLElement | null = null;
let drawerOverlay: HTMLElement | null = null;
let closeDrawerBtn: HTMLElement | null = null;

// 抽屉状态
let drawerState: DrawerState = {
  isOpen: false
};

// 应用选择回调
let onAppSelectCallback: ((appName: string, appPath: string) => void) | null = null;



// 初始化抽屉
export function initDrawer(
  onAppSelect: (appName: string, appPath: string) => void
): void {
  // 获取DOM元素
  appsContainer = document.getElementById('apps-container');
  refreshAppsBtn = document.getElementById('refresh-apps-btn');
  toggleDrawerBtn = document.getElementById('toggle-drawer');
  appDrawer = document.getElementById('app-drawer');
  drawerOverlay = document.getElementById('drawer-overlay');
  closeDrawerBtn = document.getElementById('close-drawer');

  
  // 保存应用选择回调
  onAppSelectCallback = onAppSelect;
  

  
  // 绑定事件
  bindEvents();
  
  // 加载应用列表
  loadApps();
}

// 绑定事件
function bindEvents(): void {
  // 刷新按钮事件
  refreshAppsBtn?.addEventListener('click', loadApps);
  
  // 抽屉按钮事件
  toggleDrawerBtn?.addEventListener('click', toggleDrawer);
  drawerOverlay?.addEventListener('click', closeDrawer);
  closeDrawerBtn?.addEventListener('click', closeDrawer);
  

}

// 打开抽屉
export function openDrawer(): void {
  if (!appDrawer || !drawerOverlay) return;
  
  // 确保网页抽屉是关闭的
  const webDrawer = document.getElementById('web-drawer');
  if (webDrawer && webDrawer.classList.contains('open')) {
    webDrawer.classList.remove('open');
  }
  
  appDrawer.classList.add('open');
  drawerOverlay.classList.add('show');
  drawerState.isOpen = true;
}

// 关闭抽屉
export function closeDrawer(): void {
  if (!appDrawer || !drawerOverlay) return;
  
  appDrawer.classList.remove('open');
  drawerOverlay.classList.remove('show');
  drawerState.isOpen = false;
}

// 切换抽屉状态
export function toggleDrawer(): void {
  if (drawerState.isOpen) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

// 获取抽屉状态
export function getDrawerState(): DrawerState {
  return { ...drawerState };
}



// 加载已安装的应用
export async function loadApps(): Promise<void> {
  if (!appsContainer) return;
  
  showLoadingState(appsContainer);
  
  try {
    // 检查electronAPI是否可用
    if (!window.electronAPI) {
      throw new Error('electronAPI不可用，请检查preload脚本是否正确加载');
    }
    
    console.log('开始获取已安装应用...');
    const apps = await window.electronAPI.getInstalledApps();
    console.log('获取到的应用列表:', apps);
    
    if (apps.length === 0) {
      showEmptyState(appsContainer);
      return;
    }
    
    // 清空容器
    clearAppContainer(appsContainer);
    
    // 确保容器有正确的类
    appsContainer.className = 'apps-grid';
    
    // 直接添加应用项到容器
    for (const app of apps) {
      const appItem = createAppItem(app, (appName, appPath) => {
        if (onAppSelectCallback) {
          onAppSelectCallback(appName, appPath);
        }
        closeDrawer(); // 选择应用后关闭抽屉
      });
      
      appsContainer.appendChild(appItem);
    }
  } catch (error) {
    console.error('加载应用列表失败:', error);
    showErrorState(appsContainer, error as Error);
  }
}