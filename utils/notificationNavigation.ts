let hasPendingPostNavigation = false;

export function getNotificationPostId(data: unknown) {
  if (!data || typeof data !== "object") return null;

  const payload = data as Record<string, unknown>;
  const raw = payload.post_id ?? payload.postId ?? payload.id;
  if (raw === null || raw === undefined) return null;

  const id = String(raw).trim();
  if (!/^\d+$/.test(id) || Number(id) <= 0) return null;
  return id;
}

export function markNotificationPostNavigationPending() {
  hasPendingPostNavigation = true;
}

export function isNotificationPostNavigationPending() {
  return hasPendingPostNavigation;
}
