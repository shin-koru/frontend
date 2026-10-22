export interface Movie {
  slug: string;
  title: string;
  year: number | null;
  genre: string;
  color: string;
  duration: string;
  classification: string;
  description: string;
  type: 'movie' | 'series' | 'anime' | 'cartoon';
  posterUrl?: string;
  posterObjectKey?: string;
  videoObjectKey?: string;
}
