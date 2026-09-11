import { inject, Injectable } from '@angular/core';
import { CreateProfilePayload, Profile } from '../model/profile.model';
import { ToastService } from '../../../core/services/toast.service';
import { ProfileApiService } from '../service/profile.api';
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  map,
  Observable,
  tap,
  throwError,
} from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

export interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class ProfileStore {
  private readonly toast = inject(ToastService);
  private readonly api = inject(ProfileApiService);

  private readonly stateSubject = new BehaviorSubject<ProfileState>(initialState);

  readonly profile$ = this.stateSubject.pipe(
    map((state) => state.profile),
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

  getProfileMe(): Observable<Profile> {
    this.patch({ loading: true, error: null });

    return this.api.getProfileMe().pipe(
      tap((res) => {
        this.patch({ loading: false, error: null, profile: res });
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ loading: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  createProfile(payload: CreateProfilePayload): Observable<void> {
    this.patch({ loading: true, error: null });

    return this.api.createProfile(payload).pipe(
      tap(() => {
        this.patch({ loading: false, error: null });
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ loading: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  private get snapshot(): ProfileState {
    return this.stateSubject.getValue();
  }

  private patch(partial: Partial<ProfileState>): void {
    this.stateSubject.next({ ...this.snapshot, ...partial });
  }
}
