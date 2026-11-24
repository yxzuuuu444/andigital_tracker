// Browser notifications. These only appear while the app is open; true background
// push needs a server push service, which this app doesn't have yet.

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsGranted() {
  return notificationsSupported() && Notification.permission === "granted";
}

export async function requestNotifications() {
  if (!notificationsSupported()) return "unsupported" as const;
  return Notification.requestPermission();
}

export function notify(title: string, body: string) {
  if (!notificationsGranted()) return;
  try {
    new Notification(title, { body, icon: "/icons/icon.svg" });
  } catch {
    /* some mobile browsers only allow notifications via a service worker */
  }
}
