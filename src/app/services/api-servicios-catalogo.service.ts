import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ServicioCatalogoResponse {
  id: number;
  nombre: string;
  descripcionDefault?: string;
  precioDefault: number;
  categoria?: string;
  activo: boolean;
  fechaCreacion: string;
}

export interface ServicioCatalogoCreate {
  nombre: string;
  descripcionDefault?: string;
  precioDefault: number;
  categoria?: string;
}

export interface ServicioCatalogoUpdate {
  nombre: string;
  descripcionDefault?: string;
  precioDefault: number;
  categoria?: string;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiServiciosCatalogoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/servicioscatalogo`;

  getServicios(): Observable<ServicioCatalogoResponse[]> {
    return this.http.get<ServicioCatalogoResponse[]>(this.apiUrl);
  }

  getServicioById(id: number): Observable<ServicioCatalogoResponse> {
    return this.http.get<ServicioCatalogoResponse>(`${this.apiUrl}/${id}`);
  }

  crearServicio(data: ServicioCatalogoCreate): Observable<ServicioCatalogoResponse> {
    return this.http.post<ServicioCatalogoResponse>(this.apiUrl, data);
  }

  actualizarServicio(id: number, data: ServicioCatalogoUpdate): Observable<ServicioCatalogoResponse> {
    return this.http.put<ServicioCatalogoResponse>(`${this.apiUrl}/${id}`, data);
  }

  eliminarServicio(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.apiUrl}/${id}`);
  }
}
