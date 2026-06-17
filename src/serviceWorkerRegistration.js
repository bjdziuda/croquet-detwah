export const VAPID_PUBLIC_KEY = "BBF62nsDPg3WZXeqWrvMDb4CSEFt6fgnkOKc8Jh3uwOlNM14Lh0uUm9t9WinVpivOvfu8irTLJBwIUwWAhyxVLw";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export async function register() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/service-worker.js");
  } catch (e) {
    console.error("SW registration failed:", e);
  }
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing.toJSON();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return sub.toJSON();
  } catch (e) {
    console.error("Push subscribe failed:", e);
    return null;
  }
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((r) => r.unregister())
      .catch(console.error);
  }
}
