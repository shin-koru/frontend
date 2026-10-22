import { HttpClient, HttpContext } from '@angular/common/http';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
import { inject, Injectable } from '@angular/core';
import { CreateProfilePayload, Profile } from '../model/profile.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/profile';

  public getProfileMe(): Observable<Profile> {
    return this.http.get<Profile>(`${this.baseUrl}/@me`, {
      context: new HttpContext().set(SILENT_HTTP_ERROR, true),
    });
  }

  public createProfile(data: CreateProfilePayload): Observable<void> {
    return this.http.post<void>(this.baseUrl, data);
  }
}
