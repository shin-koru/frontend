import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  map,
  Observable,
  Subject,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { User, UserPayload } from '../models/user.model';
import { UsersApi } from '../services/users.api';

export interface UsersState {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: UsersState = {
  users: [],
  selectedUser: null,
  loading: false,
  saving: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class UsersStore {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);

  private readonly stateSubject = new BehaviorSubject<UsersState>(initialState);
  private readonly loadAll$ = new Subject<void>();
  private readonly loadOne$ = new Subject<string>();

  readonly state$ = this.stateSubject.asObservable();
  readonly users$ = this.state$.pipe(
    map((state) => state.users),
    distinctUntilChanged(),
  );
  readonly selectedUser$ = this.state$.pipe(
    map((state) => state.selectedUser),
    distinctUntilChanged(),
  );
  readonly loading$ = this.state$.pipe(
    map((state) => state.loading),
    distinctUntilChanged(),
  );
  readonly saving$ = this.state$.pipe(
    map((state) => state.saving),
    distinctUntilChanged(),
  );
  readonly error$ = this.state$.pipe(
    map((state) => state.error),
    distinctUntilChanged(),
  );

  constructor() {
    this.loadAll$
      .pipe(
        tap(() => this.patch({ loading: true, error: null })),
        switchMap(() =>
          this.api.getAll().pipe(
            tap((users) => this.patch({ users, loading: false })),
            catchError((error: HttpErrorResponse) => {
              this.patch({ loading: false, error: error.message });
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();

    this.loadOne$
      .pipe(
        tap(() => this.patch({ loading: true, error: null })),
        switchMap((id) =>
          this.api.getById(id).pipe(
            tap((selectedUser) => this.patch({ selectedUser, loading: false })),
            catchError((error: HttpErrorResponse) => {
              this.patch({ selectedUser: null, loading: false, error: error.message });
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  loadUsers(): void {
    this.loadAll$.next();
  }

  loadUser(id: string): void {
    this.loadOne$.next(id);
  }

  clearSelected(): void {
    this.patch({ selectedUser: null });
  }

  createUser(payload: UserPayload): Observable<User> {
    this.patch({ saving: true, error: null });

    return this.api.create(payload).pipe(
      tap((user) => {
        this.patch({
          saving: false,
          users: [...this.snapshot.users, user],
          selectedUser: user,
        });
        this.toast.showSuccessToast('User created');
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ saving: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  updateUser(id: string, payload: UserPayload): Observable<User> {
    this.patch({ saving: true, error: null });

    return this.api.update(id, payload).pipe(
      tap((user) => {
        this.patch({
          saving: false,
          selectedUser: user,
          users: this.snapshot.users.map((item) => (item.id === id ? user : item)),
        });
        this.toast.showSuccessToast('User updated');
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ saving: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  deleteUser(id: string): Observable<void> {
    this.patch({ loading: true, error: null });

    return this.api.delete(id).pipe(
      tap(() => {
        this.patch({
          loading: false,
          users: this.snapshot.users.filter((user) => user.id !== id),
          selectedUser: this.snapshot.selectedUser?.id === id ? null : this.snapshot.selectedUser,
        });
        this.toast.showSuccessToast('User deleted');
      }),
      catchError((error: HttpErrorResponse) => {
        this.patch({ loading: false, error: error.message });
        return throwError(() => error);
      }),
    );
  }

  private get snapshot(): UsersState {
    return this.stateSubject.getValue();
  }

  private patch(partial: Partial<UsersState>): void {
    this.stateSubject.next({ ...this.snapshot, ...partial });
  }
}
