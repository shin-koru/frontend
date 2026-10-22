import { ContentItem, ContentCount, ContentPage, ContentFilters } from '../model/content.model';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
import { Movie } from '../model/movie.model';

export function contentCount(value: ContentCount | undefined): number {
  const result =
    typeof value === 'object' && value !== null
      ? value.high * 4294967296 + (value.low >>> 0)
      : Number(value ?? 0);
  return Number.isSafeInteger(result) && result >= 0 ? result : 0;
}
const kinds = ['MOVIE', 'SERIES', 'ANIME', 'CARTOON'];
export function published(item: ContentItem): boolean {
  return item.status === 'PUBLISHED' || item.status === 2;
}
export function toMovie(item: ContentItem): Movie {
  const kind = typeof item.type === 'number' ? kinds[item.type] : item.type;
  const duration = Math.max(0, item.durationSeconds ?? 0);
  const year = item.releaseDate ? new Date(item.releaseDate).getUTCFullYear() : NaN;
  let posterUrl: string | undefined;
  try {
    if (item.posterObjectKey && /^https?:\/\//i.test(item.posterObjectKey))
      posterUrl = new URL(item.posterObjectKey).href;
  } catch {
    /* An object key is not a public image URL. */
  }
  return {
    slug: item.id,
    title: item.title,
    description: item.description ?? '',
    year: Number.isFinite(year) ? year : null,
    genre: kind ? kind[0] + kind.slice(1).toLowerCase() : 'Content',
    duration: duration
      ? [
          Math.floor(duration / 3600) ? Math.floor(duration / 3600) + 'h' : '',
          Math.floor((duration % 3600) / 60) ? Math.floor((duration % 3600) / 60) + 'm' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : '',
    classification: item.ageRating ?? '',
    color: '#594178',
    type:
      kind === 'SERIES'
        ? 'series'
        : kind === 'ANIME'
          ? 'anime'
          : kind === 'CARTOON'
            ? 'cartoon'
            : 'movie',
    posterUrl,
    posterObjectKey: posterUrl ? undefined : item.posterObjectKey,
    videoObjectKey: item.videoObjectKey,
  };
}
@Injectable({ providedIn: 'root' })
export class ContentApi {
  private readonly http = inject(HttpClient);
  page(limit: number, offset: number, filters: ContentFilters = {}) {
    const { genreId, query, type, ...rest } = filters;
    // The genre route searches within movies; /search handles cross-content queries.
    // Generic browsing remains available for all types, anime and cartoons.
    let path = `/api/content/limit/${limit}/offset/${offset}`;
    if (genreId) path = `/api/genres/${encodeURIComponent(genreId)}/movies`;
    else if (query) path = '/api/search';
    else if (type === 'MOVIE') path = '/api/movies';
    else if (type === 'SERIES') path = '/api/series';
    let params = new HttpParams();
    const values = {
      ...rest,
      ...(query ? { [genreId ? 'query' : 'q']: query } : {}),
      ...(!genreId && (query || (type !== 'MOVIE' && type !== 'SERIES')) ? { type } : {}),
      ...(!path.startsWith('/api/content/') ? { limit, offset } : {}),
    };
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<ContentPage>(path, {
      params,
      context: new HttpContext().set(SILENT_HTTP_ERROR, true),
    });
  }
  detail(id: string, type?: string) {
    const resource = type === 'movie' ? 'movies' : type === 'series' ? 'series' : 'content';
    return this.http
      .get<ContentItem>(`/api/${resource}/${encodeURIComponent(id)}`, {
        context: new HttpContext().set(SILENT_HTTP_ERROR, true),
      })
      .pipe(map((item) => (published(item) ? toMovie(item) : null)));
  }
}
