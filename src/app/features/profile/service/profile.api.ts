import { HttpClient } from '@angular/common/http';
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
    return this.http.get<Profile>(`${this.baseUrl}/@me`);
  }

  public createProfile(data: CreateProfilePayload): Observable<void> {
    return this.http.post<void>(this.baseUrl, data);
  }
}
