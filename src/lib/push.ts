/**
 * Push notifications nativas do navegador (sem Web Push server).
 * Funciona enquanto a aba está aberta — útil para alertas in-session.
 */

const KEY = "nutrir.push.enabled";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function pushPermission(): PushPermission {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushPermission;
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (!pushSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  if (result === "granted") localStorage.setItem(KEY, "1");
  return result as PushPermission;
}

export function pushEnabled(): boolean {
  return pushPermission() === "granted" && localStorage.getItem(KEY) === "1";
}

export function setPushEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
}

export interface PushOpts {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
}

export function showPush({ title, body, url, tag, icon }: PushOpts): boolean {
  if (!pushEnabled()) return false;
  try {
    const n = new Notification(title, {
      body,
      tag: tag ?? "nutrir",
      icon: icon ?? "/favicon.ico",
      badge: "/favicon.ico",
    });
    n.onclick = () => {
      window.focus();
      if (url) window.location.href = url;
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
