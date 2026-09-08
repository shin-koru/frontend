import { afterNextRender, ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AuthStore } from '../../state/auth.store';
import { Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthIdentifierType } from '../../model/auth.model';
import { CommonModule } from '@angular/common';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-auth-login',
  imports: [SelectButtonModule, CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private fb = inject(NonNullableFormBuilder);

  loading$ = this.store.loading$;

  typeOptions = [
    { label: 'Email', value: 'email' },
    { label: 'Телефон', value: 'phone' },
  ];

  loginForm = this.fb.group({
    type: this.fb.control<AuthIdentifierType>('email'),
    identifier: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    this.loginForm.controls.type.valueChanges.subscribe((type) => {
      const identifierControl = this.loginForm.controls.identifier;
      identifierControl.reset();

      if (type === 'email') {
        identifierControl.setValidators([Validators.required, Validators.email]);
      } else {
        identifierControl.setValidators([
          Validators.required,
          Validators.pattern(/^\+?[0-9]{10,15}$/),
        ]);
      }

      identifierControl.updateValueAndValidity();
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAsTouched();
      return;
    }

    const payload = this.loginForm.getRawValue();
    this.store.patchOtpRequest(payload);
    this.store.sendOtp().subscribe({
      next: () => {
        console.log('Otp sent');
        this.router.navigate(['/home']);
      },
    });
  }
}
