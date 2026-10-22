import {
  APP_INITIALIZER,
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { CanActivateFn } from '@angular/router';

let initialized = false;

// Initialize the existing licensed UI library only for the legacy screens that use it.
export const legacyUiGuard: CanActivateFn = async () => {
  const parent = inject(EnvironmentInjector);
  if (initialized) return true;
  const [{ providePrimeNG }, { default: Aura }] = await Promise.all([
    import('primeng/config'),
    import('@primeuix/themes/aura'),
  ]);
  const environment = createEnvironmentInjector(
    [providePrimeNG({ theme: { preset: Aura } })],
    parent,
  );
  const initializers = environment.get(APP_INITIALIZER, []);
  for (const initialize of initializers) await runInInjectionContext(environment, initialize);
  initialized = true;
  return true;
};
