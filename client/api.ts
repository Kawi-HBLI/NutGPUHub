export type ApiError = { status: number; code: string; message: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

let onSessionExpired: () => void = () => {};

/** Called whenever a protected request returns 401, so the app can return to sign-in. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    });
  } catch {
    return { ok: false, error: { status: 0, code: 'NETWORK_ERROR', message: 'NutGPUHub is unreachable. Try again.' } };
  }
  if (response.status === 401) onSessionExpired();
  if (response.ok) return { ok: true, data: response.status === 204 ? (undefined as T) : await response.json() };
  const body = await response.json().catch(() => null);
  return {
    ok: false,
    error: {
      status: response.status,
      code: body?.error?.code ?? 'UNKNOWN_ERROR',
      message: body?.error?.message ?? 'The request could not be completed.',
    },
  };
}

const bangkokTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });

export function formatBangkokTime(iso: string) {
  return bangkokTime.format(new Date(iso));
}

export function formatBangkokDate(iso: string) {
  return bangkokDate.format(new Date(iso));
}

/** Today's date in Bangkok as YYYY-MM-DD. */
export function bangkokToday() {
  return bangkokDate.format(new Date());
}
