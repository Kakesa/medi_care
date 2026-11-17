let started = false;

export function registerServiceWorker(onUpdate: () => void) {
  if (started || !('serviceWorker' in navigator)) return;
  started = true;
  const start = () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker || !navigator.serviceWorker.controller) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') onUpdate();
        });
      });
      const refresh = window.setInterval(() => { void registration.update(); }, 60 * 60 * 1000);
      window.addEventListener('focus', () => { void registration.update(); }, { once: false });
      window.addEventListener('pagehide', () => window.clearInterval(refresh), { once: true });
    }).catch(() => undefined);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

export async function clearInstalledCache() {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
  registration?.active?.postMessage({ type: 'CLEAR' });
}

export function applyWaitingUpdate() {
  navigator.serviceWorker?.getRegistration().then((registration) => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });
}
