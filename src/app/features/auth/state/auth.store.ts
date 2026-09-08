import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  map,
  Observable,
  tap,
  throwError,
} from 'rxjs';
import { OKResponse } from '../../../shared';
import { ToastService } from '../../../core/services/toast.service';
import { OtpRequest, TokenResponse } from '../model/auth.model';
import { AuthApi } from '../service/auth.api';
import { StorageService } from '../../../core/services/storage.service';

export interface AuthState {
  otpRequest: OtpRequest | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  otpRequest: null,
  loading: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly toast = inject(ToastService);
  private readonly storage = inject(StorageService);

  private readonly stateSubject = new BehaviorSubject<AuthState>(initialState);

  readonly otpRequest$ = this.stateSubject.pipe(
    map((state) => state.otpRequest),
    distinctUntilChanged(),
  );
  readonly loading$ = this.stateSubject.pipe(
    map((state) => state.loading),
    distinctUntilChanged(),
  );
  readonly error$ = this.stateSubject.pipe(
    map((state) => state.error),
    distinctUntilChanged(),
  );

  setOtpRequest(otpRequest: OtpRequest): void {
    this.patch({ otpRequest });
  }

  patchOtpRequest(partialOtp: Partial<OtpRequest>): void {
    const currentOtp = this.snapshot.otpRequest;
    if (!currentOtp) {
      this.patch({ otpRequest: partialOtp as OtpRequest });
      return;
    }

    this.patch({
      otpRequest: { ...currentOtp, ...partialOtp },
    });
  }

  sendOtp(): Observable<OKResponse> {
    const payload = this.snapshot.otpRequest;

    if (!payload) {
      const err = 'OTP request payload is not set';
      this.patch({ error: err });
      return throwError(() => new Error(err));
    }

    this.patch({ loading: true, error: null });

    return this.api.sendOtp(payload).pipe(
      tap(() => {
        this.patch({ loading: false });
        this.toast.showSuccessToast('OTP sent successfully');
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ loading: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  verifyOtp(): Observable<TokenResponse> {
    const payload = this.snapshot.otpRequest;

    if (!payload) {
      const err = 'OTP request payload is not set';
      this.patch({ error: err });
      return throwError(() => new Error(err));
    }

    this.patch({ loading: true, error: null });

    return this.api.verifyOtp(payload).pipe(
      tap((tokenResponse) => {
        this.storage.setItem('token', tokenResponse.accessToken);
        this.patch({ loading: false });
        this.toast.showSuccessToast('Authenticated!');
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ loading: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  logout(): Observable<OKResponse> {
    this.patch({ loading: true, error: null });

    return this.api.logout().pipe(
      tap(() => {
        this.storage.removeItem('token');
        this.patch({ loading: false });
        this.toast.showSuccessToast('Logged out!');
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ loading: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  private get snapshot(): AuthState {
    return this.stateSubject.getValue();
  }

  private patch(partial: Partial<AuthState>): void {
    this.stateSubject.next({ ...this.snapshot, ...partial });
  }
}
