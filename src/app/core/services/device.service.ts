import { inject, Injectable } from '@angular/core';
import { StorageService } from './storage.service';

const KEY = 'device';

/**
 * A random label that stays with this browser so the backend can count
 * simultaneous streams per device rather than per tab or page load.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly storage = inject(StorageService);
  private cached?: string;

  id(): string {
    if (this.cached) return this.cached;
    let value: string | null = null;
    try {
      value = this.storage.getItem(KEY);
    } catch {
      value = null;
    }
    if (!value || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
      value = crypto.randomUUID();
      try {
        this.storage.setItem(KEY, value);
      } catch {
        // Storage unavailable (private mode): keep the label for this page only.
      }
    }
    this.cached = value;
    return value;
  }
}
