import { AppInfo } from './types';

// 创建应用项元素
export function createAppItem(app: AppInfo, onAppClick: (appName: string, appPath: string) => void): HTMLElement {
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
  if (window.electronAPI) {
    window.electronAPI.getIconDataUrl(app.icon)
      .then(iconDataUrl => {
        iconEl.src = iconDataUrl;
      })
      .catch(error => {
        console.error(`获取应用 ${app.name} 图标失败:`, error);
        // 使用默认图标
        iconEl.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNjY2IiBkPSJNMTkgM0g1Yy0xLjEgMC0yIC45LTIgMnYxNGMwIDEuMS45IDIgMiAyaDE0YzEuMSAwIDItLjkgMi0yVjVjMC0xLjEtLjktMi0yLTJ6bTAgMTZINVY1aDE0djE0eiIvPjwvc3ZnPg==';
      });
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
  
  // 添加点击事件
  appItem.addEventListener('click', () => onAppClick(app.name, app.action));
  
  return appItem;
}

// 显示加载状态
export function showLoadingState(container: HTMLElement): void {
  container.innerHTML = '<p class="loading">正在加载应用列表...</p>';
}

// 显示错误状态
export function showErrorState(container: HTMLElement, error: Error): void {
  container.innerHTML = `<p>加载应用列表失败: ${error.message}</p>`;
}

// 显示空状态
export function showEmptyState(container: HTMLElement): void {
  container.innerHTML = '<p>没有找到已安装的应用</p>';
}

// 清空应用列表容器
export function clearAppContainer(container: HTMLElement): void {
  container.innerHTML = '';
}