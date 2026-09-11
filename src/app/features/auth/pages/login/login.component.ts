import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AuthStore } from '../../state/auth.store';
import { Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthIdentifierType } from '../../model/auth.model';
import { CommonModule } from '@angular/common';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProfileStore } from '../../../profile/state/profile.store';

@Component({
  selector: 'app-auth-login',
  imports: [SelectButtonModule, CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly store = inject(AuthStore);
  private readonly profileStore = inject(ProfileStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly loading$ = this.store.loading$;
  readonly step = signal<'identifier' | 'code'>('identifier');

  readonly typeOptions = [
    { label: 'Email', value: 'email' },
    { label: 'Телефон', value: 'phone' },
  ];

  readonly loginForm = this.fb.group({
    type: this.fb.control<AuthIdentifierType>('email'),
    identifier: ['', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
  });

  ngOnInit(): void {
    this.loginForm.controls.type.valueChanges.subscribe((type) => {
      const identifierControl = this.loginForm.controls.identifier;
      identifierControl.reset();

      identifierControl.setValidators(type === 'email'
        ? [Validators.required, Validators.email]
        : [Validators.required, Validators.pattern(/^\+?[0-9]{10,15}$/)]);
      identifierControl.updateValueAndValidity();
    });
  }

  requestCode(): void {
    const { type, identifier } = this.loginForm.getRawValue();
    const identifierControl = this.loginForm.controls.identifier;
    if (identifierControl.invalid) {
      identifierControl.markAsTouched();
      return;
    }

    this.store.setOtpRequest({ type, identifier, code: null });
    this.store.sendOtp().subscribe({ next: () => this.step.set('code') });
  }

  verifyCode(): void {
    const codeControl = this.loginForm.controls.code;
    if (codeControl.invalid) {
      codeControl.markAsTouched();
      return;
    }

    this.store.patchOtpRequest({ code: codeControl.value });
    this.store.verifyOtp().subscribe({
      next: () => this.profileStore.getProfileMe().subscribe({
        next: () => void this.router.navigateByUrl('/'),
        error: () => void this.router.navigate(['/profile/create']),
      }),
    });
  }

  editIdentifier(): void {
    this.loginForm.controls.code.reset();
    this.step.set('identifier');
  }

  onSubmit(): void {
    this.step() === 'identifier' ? this.requestCode() : this.verifyCode();
  }
}
