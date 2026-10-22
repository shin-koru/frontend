import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { SILENT_HTTP_ERROR } from '../interceptors/http-context';

@Injectable({ providedIn: 'root' })
export class MediaUrls {
  private readonly http = inject(HttpClient);
  read(key: string, visibility: 'public' | 'private' = 'public') {
    return this.http
      .get<{ url: string }>(`/api/uploads/${visibility}`, {
        params: { objectKey: key },
        context: new HttpContext().set(SILENT_HTTP_ERROR, true),
      })
      .pipe(
        map((result) => result.url),
        catchError(() => of('')),
      );
  }
}
