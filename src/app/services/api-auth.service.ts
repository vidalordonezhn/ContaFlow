import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  usuarioId: number;
  username: string;
  nombre: string;
  email: string;
  rol: string;
}

export interface CurrentUser {
  usuarioId: number;
  username: string;
  nombre: string;
  email: string;
  rol: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiAuthService {
  private readonly http = inject(HttpClient);
  
  readonly currentUser = signal<CurrentUser | null>(null);

  constructor() {
    this.cargarSesion();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, credentials).pipe(
      tap(res => {
        localStorage.setItem('contaflow_token', res.token);
        const userObj: CurrentUser = {
          usuarioId: res.usuarioId,
          username: res.username,
          nombre: res.nombre,
          email: res.email,
          rol: res.rol
        };
        localStorage.setItem('contaflow_user', JSON.stringify(userObj));
        this.currentUser.set(userObj);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('contaflow_token');
    localStorage.removeItem('contaflow_user');
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem('contaflow_token');
  }

  private cargarSesion(): void {
    const userJson = localStorage.getItem('contaflow_user');
    const token = localStorage.getItem('contaflow_token');
    
    if (userJson && token) {
      try {
        this.currentUser.set(JSON.parse(userJson));
      } catch {
        this.logout();
      }
    }
  }
}
