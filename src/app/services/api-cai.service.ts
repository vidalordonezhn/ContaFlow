import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CAIResponse {
  id: number;
  cai: string;
  tipoDocumento: string;
  establecimiento: string;
  puntoEmision: string;
  tipoDocCodigo: string;
  rangoInicial: number;
  rangoFinal: number;
  correlativoActual: number;
  rangoInicialFormateado: string;
  rangoFinalFormateado: string;
  siguienteNumeroFormateado: string;
  fechaLimiteEmision: string;
  fechaRecepcionSAR?: string;
  activo: boolean;
  observaciones?: string;
  totalAutorizados: number;
  totalConsumidos: number;
  totalRestantes: number;
  porcentajeConsumido: number;
  estaAgotado: boolean;
  estaVencido: boolean;
  diasRestantes: number;
}

export interface CAICreate {
  cai: string;
  tipoDocumento: string;
  establecimiento: string;
  puntoEmision: string;
  tipoDocCodigo: string;
  rangoInicial: number;
  rangoFinal: number;
  fechaLimiteEmision: string;
  fechaRecepcionSAR?: string;
  activo: boolean;
  observaciones?: string;
}

export interface CAIUpdate {
  cai: string;
  tipoDocumento: string;
  establecimiento: string;
  puntoEmision: string;
  tipoDocCodigo: string;
  rangoInicial: number;
  rangoFinal: number;
  fechaLimiteEmision: string;
  activo: boolean;
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiCAIService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/cai`;

  getCAIActivo(): Observable<CAIResponse | null> {
    return this.http.get<CAIResponse | null>(`${this.apiUrl}/activo`);
  }

  getHistorial(): Observable<CAIResponse[]> {
    return this.http.get<CAIResponse[]>(this.apiUrl);
  }

  registrarNuevoCAI(dto: CAICreate): Observable<CAIResponse> {
    return this.http.post<CAIResponse>(this.apiUrl, dto);
  }

  actualizarCAI(id: number, dto: CAIUpdate): Observable<CAIResponse> {
    return this.http.put<CAIResponse>(`${this.apiUrl}/${id}`, dto);
  }
}
