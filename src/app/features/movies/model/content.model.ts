export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: string | number;
  status: string | number;
  releaseDate?: string;
  durationSeconds?: number;
  ageRating?: string;
  posterObjectKey?: string;
  videoObjectKey?: string;
  createdAt: string;
  updatedAt: string;
}
export type ContentCount = number | string | { low: number; high: number; unsigned?: boolean };
export interface ContentPage {
  items?: ContentItem[];
  meta?: { page: number; size: number; totalItem: ContentCount; totalPage: ContentCount };
}
export interface ContentFilters {
  genreId?: string;
  query?: string;
  type?: string;
  year?: number;
  sort?: string;
}
