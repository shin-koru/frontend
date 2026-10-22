import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../state/auth.store';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthIdentifierType } from '../../model/auth.model';
import { CommonModule } from '@angular/common';
import { ProfileStore } from '../../../profile/state/profile.store';
import { ButtonDirective } from '../../../../shared/ui/button.directive';

@Component({
  selector: 'app-auth-login',
  imports: [CommonModule, ReactiveFormsModule, ButtonDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly store = inject(AuthStore);
  private readonly profileStore = inject(ProfileStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading$ = this.store.loading$;
  readonly error = signal('');
  readonly step = signal<'identifier' | 'code'>('identifier');

  readonly typeOptions = [
    { label: 'Email', value: 'email' },
    { label: 'Phone', value: 'phone' },
  ];

  readonly loginForm = this.fb.group({
    type: this.fb.control<AuthIdentifierType>('email'),
    identifier: ['', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit(): void {
    this.loginForm.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => {
        const identifierControl = this.loginForm.controls.identifier;
        identifierControl.reset();

        identifierControl.setValidators(
          type === 'email'
            ? [Validators.required, Validators.email]
            : [Validators.required, Validators.pattern(/^\+?[0-9]{10,15}$/)],
        );
        identifierControl.updateValueAndValidity();
      });
  }

  requestCode(): void {
    this.error.set('');
    const { type, identifier } = this.loginForm.getRawValue();
    const identifierControl = this.loginForm.controls.identifier;
    if (identifierControl.invalid) {
      identifierControl.markAsTouched();
      return;
    }

    this.store.setOtpRequest({ type, identifier, code: null });
    this.store.sendOtp().subscribe({
      next: () => this.step.set('code'),
      error: () =>
        this.error.set(
          'We couldn’t send your sign-in code. Please check your details and try again.',
        ),
    });
  }

  verifyCode(): void {
    this.error.set('');
    const codeControl = this.loginForm.controls.code;
    if (codeControl.invalid) {
      codeControl.markAsTouched();
      return;
    }

    this.store.patchOtpRequest({ code: codeControl.value });
    this.store.verifyOtp().subscribe({
      next: () =>
        this.profileStore.getProfileMe().subscribe({
          next: () => void this.router.navigateByUrl(this.returnUrl()),
          error: (error) =>
            error.status === 404
              ? void this.router.navigate(['/profile/create'], {
                  queryParams: { returnUrl: this.returnUrl() },
                })
              : void this.router.navigateByUrl('/profile'),
        }),
      error: () =>
        this.error.set(
          'That code could not be verified. Check the code and try again, or request a new one.',
        ),
    });
  }

  editIdentifier(): void {
    this.error.set('');
    this.loginForm.controls.code.reset();
    this.step.set('identifier');
  }
  private returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    return url.startsWith('/') &&
      !url.startsWith('//') &&
      !url.includes('\\') &&
      !url.startsWith('/auth') &&
      !url.startsWith('/login')
      ? url
      : '/';
  }

  onSubmit(): void {
    this.step() === 'identifier' ? this.requestCode() : this.verifyCode();
  }
}
