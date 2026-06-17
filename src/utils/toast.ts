/** Simple toast notification system — renders via DOM to avoid React state complexity */

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:360px;width:calc(100% - 32px)';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
  const c = getContainer();
  const el = document.createElement('div');
  const bg = type === 'success' ? '#2d5a3d' : type === 'error' ? '#5a2d2d' : '#504840';
  const border = type === 'success' ? '#4caf50' : type === 'error' ? '#e05050' : '#6b5f55';
  const color = type === 'success' ? '#a0e0a0' : type === 'error' ? '#f0a0a0' : '#e0d8c8';
  el.style.cssText = `background:${bg};border:2px solid ${border};color:${color};padding:12px 16px;border-radius:12px;font-family:Cinzel,serif;font-size:13px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.5);pointer-events:auto;animation:slideIn 0.3s ease-out;letter-spacing:0.5px`;
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, duration);
}
