import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentApi } from './content.api';
import { GenreStore } from '../state/genre.store';

describe('Catalog endpoint routing', () => {
  let api: ContentApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), GenreStore],
    });
    api = TestBed.inject(ContentApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it.each([
    ['MOVIE', '/api/movies'],
    ['SERIES', '/api/series'],
  ])('routes %s lists with pagination and filters', (type, url) => {
    api.page(12, 24, { type, year: 2020, sort: 'title' }).subscribe();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('offset')).toBe('24');
    expect(req.request.params.get('year')).toBe('2020');
    expect(req.request.params.has('type')).toBe(false);
    req.flush({ items: [] });
  });
  it('uses q for cross-content search and retains the type', () => {
    api.page(12, 0, { query: 'interstellar', type: 'MOVIE' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/search');
    expect(req.request.params.get('q')).toBe('interstellar');
    expect(req.request.params.get('type')).toBe('MOVIE');
    req.flush({ items: [] });
  });
  it('combines genre membership with search and pagination on the genre endpoint', () => {
    api.page(12, 12, { genreId: 'genre-id', query: 'space', type: 'MOVIE' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/genres/genre-id/movies');
    expect(req.request.params.get('query')).toBe('space');
    expect(req.request.params.get('offset')).toBe('12');
    expect(req.request.params.has('genreId')).toBe(false);
    req.flush({ items: [] });
  });
  it.each([
    ['movie', 'movies'],
    ['series', 'series'],
    ['anime', 'content'],
    [undefined, 'content'],
  ])('routes %s details without guessing unknown types', (type, resource) => {
    api.detail('id', type).subscribe();
    http.expectOne(`/api/${resource}/id`).flush({ status: 'PUBLISHED', type: 'MOVIE' });
  });
  it('loads sorted genres and retries failures independently of catalog results', () => {
    const genres = TestBed.inject(GenreStore);
    genres.load();
    genres.load();
    http.expectOne('/api/genres').flush({}, { status: 500, statusText: 'Error' });
    expect(genres.error()).toBe(true);
    expect(genres.loading()).toBe(false);
    genres.load();
    http.expectOne('/api/genres').flush({
      genres: [
        { id: '2', name: 'Science fiction' },
        { id: '1', name: 'Drama' },
      ],
    });
    expect(genres.genres().map((g) => g.name)).toEqual(['Drama', 'Science fiction']);
    expect(genres.error()).toBe(false);
  });
});
