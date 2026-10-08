import { UserProfile } from '../types';

// Browser side of the secure server (/api/app). The browser only holds a signed session
// token - no Supabase keys, no admin password.

export interface Session {
  token: string;
  role: 'admin' | 'user';
  exp: number; // ms
  profile: UserProfile;
  tzOffsetMinutes?: number;
}

const SESSION_KEY = 'match_session_v1';

function tokenExp(token: string): number {
  try {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(body)).exp || 0;
  } catch {
    return 0;
  }
}

export function loadSession(): Session | null {
  // Admin session lives only in this tab (sessionStorage); agent session survives restarts.
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      const s = JSON.parse(raw) as Session;
      if (s?.token && s.exp > Date.now() && s.profile) return s;
      store.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }
  return null;
}

export function saveSession(token: string, profile: UserProfile, tzOffsetMinutes?: number) {
  const session: Session = {
    token,
    role: profile.role === 'admin' ? 'admin' : 'user',
    exp: tokenExp(token),
    profile,
    tzOffsetMinutes,
  };
  clearSession();
  try {
    (session.role === 'admin' ? sessionStorage : localStorage).setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const session = loadSession();
  let res: Response;
  try {
    res = await fetch('/api/app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify({ action, ...params }),
    });
  } catch {
    throw new ApiError(0, 'Server se connect nahi ho paya. Internet check karke dobara try karein.');
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, 'Server API (/api/app) nahi mila. Vercel deployment check karein.');
  }

  if (!res.ok) {
    if (res.status === 401 && session && action !== 'admin-login' && action !== 'agent-login') {
      clearSession();
      window.dispatchEvent(new Event('match-session-expired'));
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}
