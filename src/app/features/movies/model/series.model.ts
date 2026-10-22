export interface Season {
  id: string;
  contentId: string;
  seasonNumber: number;
  title?: string;
  description?: string;
  status: string;
}
export interface Episode {
  id: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  description?: string;
  releaseDate?: string;
  durationSeconds?: number;
  videoKey?: string;
  status: string;
}
export interface SeasonDetails {
  seasonNumber: number;
  title: string;
  description: string;
}
export interface EpisodeDetails {
  episodeNumber: number;
  title: string;
  description: string;
  releaseDate?: string;
  durationSeconds?: number;
  clearReleaseDate?: boolean;
  clearDurationSeconds?: boolean;
}
