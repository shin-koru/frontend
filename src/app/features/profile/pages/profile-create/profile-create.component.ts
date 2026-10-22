import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from '../../../../shared/ui/button.directive';
import { ProfileStore } from '../../state/profile.store';
import { CreateProfilePayload } from '../../model/profile.model';

@Component({
  selector: 'app-profile-create',
  imports: [AsyncPipe, ReactiveFormsModule, ButtonDirective],
  templateUrl: './profile-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCreateComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly store = inject(ProfileStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly error = signal('');

  readonly loading$ = this.store.loading$;
  readonly countries = [
    { label: 'Kazakhstan', value: 'KZ' },
    { label: 'Kyrgyzstan', value: 'KG' },
    { label: 'Uzbekistan', value: 'UZ' },
    { label: 'Other', value: 'OTHER' },
  ];
  readonly form = this.fb.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/),
      ],
    ],
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    country: this.fb.control('KZ', Validators.required),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: CreateProfilePayload = this.form.getRawValue();
    this.store.createProfile(payload).subscribe({
      next: () => {
        const url = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/profile';
        void this.router.navigateByUrl(
          url.startsWith('/') &&
            !url.startsWith('//') &&
            !url.includes('\\') &&
            !url.startsWith('/auth') &&
            !url.startsWith('/profile/create')
            ? url
            : '/profile',
        );
      },
      error: () => this.error.set('Your profile could not be created. Please try again.'),
    });
  }

  hasError(control: keyof typeof this.form.controls, error: string): boolean {
    const field = this.form.controls[control];
    return field.touched && field.hasError(error);
  }
}
