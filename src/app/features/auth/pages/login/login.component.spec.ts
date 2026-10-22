import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../state/auth.store';
import { ProfileStore } from '../../../profile/state/profile.store';
import { LoginComponent } from './login.component';

describe('SHIN verification-code login', () => {
  const auth = {
    loading$: of(false),
    setOtpRequest: vi.fn(),
    patchOtpRequest: vi.fn(),
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
  };
  const profile = { getProfileMe: vi.fn() };
  const router = { navigateByUrl: vi.fn(), navigate: vi.fn() };
  let component: LoginComponent;
  beforeEach(() => {
    vi.clearAllMocks();
    auth.sendOtp.mockReturnValue(of({ ok: true }));
    auth.verifyOtp.mockReturnValue(of({ accessToken: 'test-token' }));
    profile.getProfileMe.mockReturnValue(of({ id: 'test-profile' }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: AuthStore, useValue: auth },
        { provide: ProfileStore, useValue: profile },
        { provide: Router, useValue: router },
      ],
    });
    component = TestBed.runInInjectionContext(() => new LoginComponent());
    component.ngOnInit();
  });
  it('blocks invalid email without making an API request', () => {
    component.loginForm.controls.identifier.setValue('not-an-email');
    component.requestCode();
    expect(auth.sendOtp).not.toHaveBeenCalled();
    expect(component.loginForm.controls.identifier.touched).toBe(true);
  });
  it('keeps phone login and its validation working', () => {
    component.loginForm.controls.type.setValue('phone');
    component.loginForm.controls.identifier.setValue('+77001234567');
    component.requestCode();
    expect(auth.setOtpRequest).toHaveBeenCalledWith({
      type: 'phone',
      identifier: '+77001234567',
      code: null,
    });
    expect(component.step()).toBe('code');
  });
  it('verifies a code and routes an existing user home', () => {
    component.loginForm.controls.code.setValue('123456');
    component.verifyCode();
    expect(auth.patchOtpRequest).toHaveBeenCalledWith({ code: '123456' });
    expect(profile.getProfileMe).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });
  it('routes a new authenticated user to existing profile creation', () => {
    profile.getProfileMe.mockReturnValue(throwError(() => ({ status: 404 })));
    component.loginForm.controls.code.setValue('123456');
    component.verifyCode();
    expect(router.navigate).toHaveBeenCalledWith(['/profile/create'], {
      queryParams: { returnUrl: '/' },
    });
  });
  it('displays failed verification and stays on the code step', () => {
    auth.verifyOtp.mockReturnValue(throwError(() => new Error('Invalid code')));
    component.step.set('code');
    component.loginForm.controls.code.setValue('123456');
    component.verifyCode();
    expect(component.error()).toContain('could not be verified');
    expect(component.step()).toBe('code');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
