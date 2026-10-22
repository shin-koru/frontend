import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from '../services/storage.service';
import { SessionService } from '../services/session.service';
import { authInterceptor } from './auth.interceptor';

describe('Real API session behavior', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let session: SessionService;
  const router = { url: '/profile', navigate: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        {
          provide: StorageService,
          useValue: { getItem: () => 'expired-access', setItem: vi.fn(), removeItem: vi.fn() },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
  });
  afterEach(() => requests.verify());
  it('attaches the access token to protected identity endpoints', () => {
    http.get('/api/auth/me').subscribe();
    const identity = requests.expectOne('/api/auth/me');
    expect(identity.request.headers.get('Authorization')).toBe('Bearer expired-access');
    identity.flush({ role: 'ADMIN' });
  });
  it('shares one cookie refresh across concurrent expired requests and retries them', () => {
    const values: unknown[] = [];
    http.get('/api/profile/@me').subscribe((value) => values.push(value));
    http.get('/api/content/limit/12/offset/0').subscribe((value) => values.push(value));
    const profile = requests.expectOne('/api/profile/@me');
    expect(profile.request.headers.get('Authorization')).toBe('Bearer expired-access');
    profile.flush({}, { status: 401, statusText: 'Unauthorized' });
    requests
      .expectOne('/api/content/limit/12/offset/0')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = requests.expectOne('/api/auth/refresh');
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush({ accessToken: 'renewed-access' });
    const retriedProfile = requests.expectOne('/api/profile/@me');
    const retriedContent = requests.expectOne('/api/content/limit/12/offset/0');
    expect(retriedProfile.request.headers.get('Authorization')).toBe('Bearer renewed-access');
    expect(retriedContent.request.headers.get('Authorization')).toBe('Bearer renewed-access');
    retriedProfile.flush({ id: 'profile' });
    retriedContent.flush({ items: [] });
    expect(values).toHaveLength(2);
    expect(session.token()).toBe('renewed-access');
  });
  it('does not refresh invalid OTPs or leak bearer tokens to authentication or external URLs', () => {
    http.post('/api/auth/otp/verify', {}).subscribe({ error: () => {} });
    const otp = requests.expectOne('/api/auth/otp/verify');
    expect(otp.request.headers.has('Authorization')).toBe(false);
    otp.flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectNone('/api/auth/refresh');
    http.get('https://example.com/asset').subscribe();
    const external = requests.expectOne('https://example.com/asset');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({});
  });
  it('clears a rejected session and preserves the requested route for sign-in', () => {
    http.get('/api/profile/@me').subscribe({ error: () => {} });
    requests.expectOne('/api/profile/@me').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/api/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/profile' },
    });
  });
});
