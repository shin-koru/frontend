import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StorageService } from '../services/storage.service';

export const authGuard: CanActivateFn = () => {
  const storageService = inject(StorageService);
  const router = inject(Router);

  if (storageService.getItem('token')) return true;

  return router.createUrlTree(['/login'])
};
