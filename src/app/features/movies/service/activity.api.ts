import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
export type PlayableKind = 'content' | 'episode';
export interface ActivityItem {
  id: string;
  contentId: string;
  kind: PlayableKind;
  title: string;
  parentContentId?: string;
  parentTitle?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  positionSeconds?: number;
  durationSeconds?: number;
  status?: string;
  startedAt?: string;
  lastWatchedAt?: string;
  completedAt?: string;
  createdAt?: string;
}
export interface ActivityPage {
  items?: ActivityItem[];
  meta?: { totalItem: number | string };
}
export interface ProgressReport {
  sequence: number;
  positionSeconds: number;
  durationSeconds?: number;
}
// Used only to discard cached UI state on account changes. Authorization remains server-side.
export function sessionAccount(token: string | null): string {
  if (!token) return '';
  try {
    const payload: unknown = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    );
    return typeof payload === 'object' &&
      payload !== null &&
      'sub' in payload &&
      typeof payload.sub === 'string'
      ? payload.sub
      : token;
  } catch {
    return token;
  }
}
@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);
  readonly revision = signal(0);
  changed() {
    this.revision.update((n) => n + 1);
  }
  private options() {
    return { context: new HttpContext().set(SILENT_HTTP_ERROR, true) };
  }
  page(mode: 'favorites' | 'history' | 'continue', offset = 0, limit = 12) {
    const path =
      mode === 'favorites'
        ? 'favorites'
        : mode === 'history'
          ? 'watch-history'
          : 'watch-history/continue-watching';
    return this.http.get<ActivityPage>(`/api/${path}`, {
      ...this.options(),
      params: { limit, offset },
    });
  }
  status(id: string) {
    return this.http.get<{ favorite: boolean }>(
      `/api/favorites/${encodeURIComponent(id)}/status`,
      this.options(),
    );
  }
  favorite(id: string, add: boolean) {
    return add
      ? this.http.put<{ favorite: boolean }>(
          `/api/favorites/${encodeURIComponent(id)}`,
          {},
          this.options(),
        )
      : this.http.delete<{ favorite: boolean }>(
          `/api/favorites/${encodeURIComponent(id)}`,
          this.options(),
        );
  }
  report(id: string, report: ProgressReport) {
    return this.http.put<ActivityItem>(
      `/api/playback-sessions/${encodeURIComponent(id)}/progress`,
      report,
      this.options(),
    );
  }
  remove(id: string, kind: PlayableKind) {
    return this.http.delete(`/api/watch-history/progress/${encodeURIComponent(id)}`, {
      ...this.options(),
      params: { kind },
    });
  }
  clear() {
    return this.http.delete('/api/watch-history', this.options());
  }
}
