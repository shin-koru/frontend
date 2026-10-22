import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly storage = inject(StorageService);
  private readonly http = new HttpClient(inject(HttpBackend));
  private refreshing?: Observable<string>;
  readonly token = signal(this.storage.getItem('token'));

  acceptToken(token: string): void {
    this.storage.setItem('token', token);
    this.token.set(token);
  }
  clear(): void {
    this.storage.removeItem('token');
    this.token.set(null);
  }
  refresh(): Observable<string> {
    if (!this.refreshing) {
      this.refreshing = this.http
        .post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
        .pipe(
          map((response) => {
            if (!response.accessToken) throw new Error('Missing access token');
            return response.accessToken;
          }),
          tap((token) => this.acceptToken(token)),
          finalize(() => {
            this.refreshing = undefined;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refreshing;
  }
  restore(): Observable<boolean> {
    return this.token()
      ? of(true)
      : this.refresh().pipe(
          map(() => true),
          catchError(() => of(false)),
        );
  }
}
