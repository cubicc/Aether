// DOM元素
let webDrawer: HTMLElement | null = null;
let drawerOverlay: HTMLElement | null = null;
let closeWebDrawerBtn: HTMLElement | null = null;
let toggleWebDrawerBtn: HTMLElement | null = null;
let webUrlInput: HTMLInputElement | null = null;
let webOpenBtn: HTMLElement | null = null;
let quickLinks: NodeListOf<Element> | null = null;

// 抽屉状态
let webDrawerState = {
  isOpen: false
};

// 网页打开回调
let onWebOpenCallback: ((url: string) => void) | null = null;

// 初始化网页抽屉
export function initWebDrawer(onWebOpen: (url: string) => void): void {
  // 获取DOM元素
  webDrawer = document.getElementById('web-drawer');
  drawerOverlay = document.getElementById('drawer-overlay');
  closeWebDrawerBtn = document.getElementById('close-web-drawer');
  toggleWebDrawerBtn = document.getElementById('toggle-web-drawer');
  webUrlInput = document.getElementById('web-url-input') as HTMLInputElement;
  webOpenBtn = document.getElementById('web-open-btn');
  quickLinks = document.querySelectorAll('.quick-link');
  
  // 保存网页打开回调
  onWebOpenCallback = onWebOpen;
  
  // 绑定事件
  bindEvents();
}

// 绑定事件
function bindEvents(): void {
  // 抽屉按钮事件
  toggleWebDrawerBtn?.addEventListener('click', toggleWebDrawer);
  drawerOverlay?.addEventListener('click', closeWebDrawer);
  closeWebDrawerBtn?.addEventListener('click', closeWebDrawer);
  
  // 网页输入相关事件
  webOpenBtn?.addEventListener('click', handleOpenWeb);
  webUrlInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleOpenWeb();
    }
  });
  
  // 常用网站快捷方式事件
  quickLinks?.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = (link as HTMLElement).dataset.url;
      if (url && onWebOpenCallback) {
        onWebOpenCallback(url);
        closeWebDrawer();
      }
    });
  });
}

// 打开网页抽屉
export function openWebDrawer(): void {
  if (!webDrawer || !drawerOverlay) return;
  
  // 确保应用抽屉是关闭的
  const appDrawer = document.getElementById('app-drawer');
  if (appDrawer && appDrawer.classList.contains('open')) {
    appDrawer.classList.remove('open');
  }
  
  webDrawer.classList.add('open');
  drawerOverlay.classList.add('show');
  webDrawerState.isOpen = true;
  
  // 聚焦到URL输入框
  if (webUrlInput) {
    setTimeout(() => {
      webUrlInput.focus();
    }, 300);
  }
}

// 关闭网页抽屉
export function closeWebDrawer(): void {
  if (!webDrawer || !drawerOverlay) return;
  
  webDrawer.classList.remove('open');
  drawerOverlay.classList.remove('show');
  webDrawerState.isOpen = false;
}

// 切换网页抽屉状态
export function toggleWebDrawer(): void {
  if (webDrawerState.isOpen) {
    closeWebDrawer();
  } else {
    openWebDrawer();
  }
}

// 获取网页抽屉状态
export function getWebDrawerState(): { isOpen: boolean } {
  return { ...webDrawerState };
}

// 处理打开网页
function handleOpenWeb(): void {
  if (!webUrlInput || !onWebOpenCallback) return;
  
  const url = webUrlInput.value.trim();
  if (!url) {
    alert('请输入有效的网址');
    return;
  }
  
  // 简单的URL验证
  let validUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    validUrl = `https://${url}`;
  }
  
  try {
    new URL(validUrl);
    onWebOpenCallback(validUrl);
    webUrlInput.value = '';
    closeWebDrawer();
  } catch (error) {
    alert('请输入有效的网址');
  }
}