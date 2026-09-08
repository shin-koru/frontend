import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../../state/auth.store';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-auth-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly store = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
}
