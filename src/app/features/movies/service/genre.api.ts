import { Genre } from '../model/genre.model';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';

@Injectable({ providedIn: 'root' })
export class GenreApi {
  private readonly http = inject(HttpClient);
  list() {
    return this.http.get<{ genres?: Genre[] }>('/api/genres', {
      context: new HttpContext().set(SILENT_HTTP_ERROR, true),
    });
  }
}
