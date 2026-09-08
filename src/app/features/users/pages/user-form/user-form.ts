import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { FloatLabel } from 'primeng/floatlabel';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { filter, map } from 'rxjs';
import { USER_ROLES, UserPayload, UserRole } from '../../models/user.model';
import { UsersStore } from '../../state/users.store';

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, Button, InputText, FloatLabel, Select, Checkbox],
  templateUrl: './user-form.html',
  styleUrl: './user-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserForm {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(UsersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly roles = USER_ROLES;
  readonly saving = toSignal(this.store.saving$, { initialValue: false });
  readonly loading = toSignal(this.store.loading$, { initialValue: false });
  readonly userId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  readonly isEdit = computed(() => !!this.userId());
  readonly title = computed(() => (this.isEdit() ? 'Edit user' : 'New user'));

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    role: this.fb.nonNullable.control<UserRole>('user', Validators.required),
    isActive: true,
    password: [''],
  });

  constructor() {
    effect(() => {
      const id = this.userId();
      this.form.controls.password.setValidators(
        id ? [] : [Validators.required, Validators.minLength(8)],
      );
      this.form.controls.password.updateValueAndValidity({ emitEvent: false });

      if (id) {
        this.store.loadUser(id);
      } else {
        this.store.clearSelected();
        this.form.reset({
          username: '',
          email: '',
          firstName: '',
          lastName: '',
          role: 'user',
          isActive: true,
          password: '',
        });
      }
    });

    this.store.selectedUser$
      .pipe(
        filter((user): user is NonNullable<typeof user> => !!user && user.id === this.userId()),
        takeUntilDestroyed(),
      )
      .subscribe((user) => {
        this.form.patchValue({
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          password: '',
        });
      });
  }

  goToList(): void {
    void this.router.navigate(['/users']);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, ...rest } = this.form.getRawValue();
    const payload: UserPayload = {
      ...rest,
      ...(password ? { password } : {}),
    };

    const request$ = this.isEdit()
      ? this.store.updateUser(this.userId()!, payload)
      : this.store.createUser(payload);

    request$.subscribe({
      next: (user) => void this.router.navigate(['/users', user.id]),
    });
  }

  hasError(controlName: keyof typeof this.form.controls, error: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(error);
  }
}
