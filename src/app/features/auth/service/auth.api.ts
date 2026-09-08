import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { OtpRequest, TokenResponse } from '../model/auth.model';
import { Observable } from 'rxjs';
import { OKResponse } from '../../../shared';

@Injectable({
  providedIn: 'root',
})
export class AuthApi {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/auth';

  sendOtp(req: OtpRequest): Observable<OKResponse> {
    return this.http.post<OKResponse>(`${this.baseUrl}/otp/send`, req);
  }

  verifyOtp(req: OtpRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.baseUrl}/otp/verify`, req);
  }

  logout(): Observable<OKResponse> {
    return this.http.post<OKResponse>(`${this.baseUrl}/logout`, {});
  }
}
