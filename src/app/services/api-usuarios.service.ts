import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioResponse {
  id: number;
  username: string;
  nombre: string;
  email?: string;
  telefono?: string;
  rol: string;
  activo: boolean;
  ultimoAcceso?: string;
  fechaCreacion: string;
}

export interface UsuarioCreate {
  username: string;
  nombre: string;
  email?: string;
  telefono?: string;
  password: string;
  rol: string;
}

export interface UsuarioUpdate {
  nombre: string;
  email?: string;
  telefono?: string;
  rol: string;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiUsuariosService {
  private readonly http = inject(HttpClient);

  getUsuarios(): Observable<UsuarioResponse[]> {
    return this.http.get<UsuarioResponse[]>(`${environment.apiUrl}/api/usuarios`);
  }

  crearUsuario(usuario: UsuarioCreate): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(`${environment.apiUrl}/api/usuarios`, usuario);
  }

  actualizarUsuario(id: number, usuario: UsuarioUpdate): Observable<UsuarioResponse> {
    return this.http.put<UsuarioResponse>(`${environment.apiUrl}/api/usuarios/${id}`, usuario);
  }

  cambiarPassword(username: string, newPassword: string): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/api/usuarios/password`, { username, newPassword });
  }

  toggleStatus(id: number): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/api/usuarios/${id}/toggle-status`, {});
  }
}
