import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiAuthService } from '../services/api-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly authService = inject(ApiAuthService);
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly password = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal(false);

  onSubmit(): void {
    if (!this.username() || !this.password()) {
      this.errorMessage.set('Por favor ingresa tu usuario y contraseña.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login({
      username: this.username(),
      password: this.password()
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/usuarios']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err.error?.mensaje || 'Error al iniciar sesión. Verifica tus credenciales.';
        this.errorMessage.set(errorMsg);
      }
    });
  }
}
