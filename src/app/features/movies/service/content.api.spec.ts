import { describe, expect, it } from 'vitest';
import { contentCount, published, toMovie } from './content.api';
import { ContentItem } from '../model/content.model';

const item: ContentItem = {
  id: '5bf81a5f-59ca-4ddb-8e0c-108b44e39a48',
  title: 'Backend title',
  type: 'MOVIE',
  status: 'PUBLISHED',
  createdAt: '',
  updatedAt: '',
};
describe('Backend content contract', () => {
  it('normalizes the live gateway Long pagination representation', () => {
    expect(contentCount({ low: 3, high: 0, unsigned: false })).toBe(3);
    expect(contentCount({ low: -1, high: 0 })).toBe(4294967295);
    expect(contentCount('24')).toBe(24);
    expect(contentCount({ low: 0, high: 1 })).toBe(4294967296);
    expect(contentCount(-1)).toBe(0);
  });
  it('only exposes published titles for numeric and string enum representations', () => {
    expect(published(item)).toBe(true);
    expect(published({ ...item, status: 2 })).toBe(true);
    expect(published({ ...item, status: 'DRAFT' })).toBe(false);
    expect(published({ ...item, status: 'ARCHIVED' })).toBe(false);
  });
  it('uses real UUIDs and does not invent unavailable metadata', () => {
    const movie = toMovie(item);
    expect(movie.slug).toBe(item.id);
    expect(movie.year).toBeNull();
    expect(movie.duration).toBe('');
    expect(movie.classification).toBe('');
    expect(movie.posterUrl).toBeUndefined();
  });
  it('maps release dates, duration, content types, and real public poster URLs', () => {
    const movie = toMovie({
      ...item,
      type: 1,
      releaseDate: '2024-02-01',
      durationSeconds: 9960,
      ageRating: '16+',
      posterObjectKey: 'https://cdn.example.com/poster.jpg',
    });
    expect(movie.type).toBe('series');
    expect(movie.year).toBe(2024);
    expect(movie.duration).toBe('2h 46m');
    expect(movie.posterUrl).toBe('https://cdn.example.com/poster.jpg');
    expect(toMovie({ ...item, posterObjectKey: 'private/poster.jpg' }).posterUrl).toBeUndefined();
    expect(toMovie({ ...item, posterObjectKey: 'javascript:alert(1)' }).posterUrl).toBeUndefined();
  });
});
