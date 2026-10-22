import { Season, Episode, SeasonDetails, EpisodeDetails } from '../model/series.model';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class SeriesApi {
  private readonly http = inject(HttpClient);
  seasons(contentId: string) {
    return this.http.get<{ seasons?: Season[] }>(`/api/content/admin/${contentId}/season`);
  }
  episodes(seasonId: string) {
    return this.http.get<{ episodes?: Episode[] }>(`/api/season/admin/${seasonId}/episode`);
  }
  saveSeason(contentId: string, id: string | undefined, details: SeasonDetails) {
    return id
      ? this.http.put<Season>(`/api/season/${id}`, details)
      : this.http.post<Season>(`/api/content/${contentId}/season`, details);
  }
  saveEpisode(seasonId: string, id: string | undefined, details: EpisodeDetails) {
    return id
      ? this.http.put<Episode>(`/api/episode/${id}`, details)
      : this.http.post<Episode>(`/api/season/${seasonId}/episode`, details);
  }
  status(kind: 'season' | 'episode', id: string, action: 'publish' | 'archive') {
    return action === 'publish'
      ? this.http.patch(`/api/${kind}/${id}/publish`, {})
      : this.http.delete(`/api/${kind}/${id}`);
  }
}
