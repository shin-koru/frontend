import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ProfileStore } from '../../state/profile.store';
import { CreateProfilePayload } from '../../model/profile.model';

@Component({
  selector: 'app-profile-create',
  imports: [AsyncPipe, ButtonModule, InputTextModule, ReactiveFormsModule, SelectModule],
  templateUrl: './profile-create.component.html',
  styleUrl: './profile-create.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCreateComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly store = inject(ProfileStore);
  private readonly router = inject(Router);

  readonly loading$ = this.store.loading$;
  readonly countries = [
    { label: 'Казахстан', value: 'KZ' },
    { label: 'Кыргызстан', value: 'KG' },
    { label: 'Узбекистан', value: 'UZ' },
    { label: 'Другая страна', value: 'OTHER' },
  ];
  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
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
      next: () => void this.router.navigateByUrl('/'),
    });
  }

  hasError(control: keyof typeof this.form.controls, error: string): boolean {
    const field = this.form.controls[control];
    return field.touched && field.hasError(error);
  }
}
