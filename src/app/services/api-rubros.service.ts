import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RubroResponse {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface RubroCreate {
  nombre: string;
  descripcion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiRubrosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5057/api/rubros';

  getRubros(): Observable<RubroResponse[]> {
    return this.http.get<RubroResponse[]>(this.baseUrl);
  }

  crearRubro(dto: RubroCreate): Observable<RubroResponse> {
    return this.http.post<RubroResponse>(this.baseUrl, dto);
  }

  eliminarRubro(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
