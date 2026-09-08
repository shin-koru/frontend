import { inject, Injectable } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  private readonly confirmationPrimeng = inject(ConfirmationService);
  private readonly toastService = inject(ToastService);

  confirmDelete(event: Event) {
    this.confirmationPrimeng.confirm({
      target: event.target as EventTarget,
      message: 'Do you want to delete this record?',
      header: 'Danger Zone',
      icon: 'pi pi-info-circle',
      rejectLabel: 'Cancel',

      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger',
      },

      accept: () => {
        this.toastService.showInfoToast('Record deleted');
      },
      reject: () => {
        this.toastService.showWarnToast('You have rejected');
      },
    });
  }
}
