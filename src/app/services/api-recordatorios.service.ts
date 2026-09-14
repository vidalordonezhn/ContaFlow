import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RecordatorioResponse {
  id: number;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  telefonoWhatsApp?: string;
  email?: string;
  cuotaMensual?: number;
  tipo: 'SAR' | 'Cobro' | 'Declaracion' | 'Personalizado';
  titulo?: string;
  mensaje: string;
  canal: string;
  estado: 'Pendiente' | 'Enviado' | 'Respondido' | 'Omitido';
  fechaEnvio?: string;
  fechaCreacion: string;
}

export interface RecordatorioCreate {
  clienteId: number;
  tipo: 'SAR' | 'Cobro' | 'Declaracion' | 'Personalizado';
  titulo?: string;
  mensaje: string;
  canal?: string;
  estado?: string;
  telefonoDestino?: string;
  emailDestino?: string;
}

export interface RecordatorioUpdate {
  titulo?: string;
  mensaje?: string;
  estado?: string;
  canal?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiRecordatoriosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/recordatorios`;

  getRecordatorios(clienteId?: number, tipo?: string, estado?: string): Observable<RecordatorioResponse[]> {
    let params: any = {};
    if (clienteId) params.clienteId = clienteId.toString();
    if (tipo) params.tipo = tipo;
    if (estado) params.estado = estado;
    return this.http.get<RecordatorioResponse[]>(this.baseUrl, { params });
  }

  getRecordatorioById(id: number): Observable<RecordatorioResponse> {
    return this.http.get<RecordatorioResponse>(`${this.baseUrl}/${id}`);
  }

  crearRecordatorio(dto: RecordatorioCreate): Observable<RecordatorioResponse> {
    return this.http.post<RecordatorioResponse>(this.baseUrl, dto);
  }

  actualizarEstado(id: number, dto: RecordatorioUpdate): Observable<RecordatorioResponse> {
    return this.http.put<RecordatorioResponse>(`${this.baseUrl}/${id}/estado`, dto);
  }

  eliminarRecordatorio(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.baseUrl}/${id}`);
  }

  limpiarEnviados(): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.baseUrl}/limpiar-enviados`, {});
  }
}
