import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReciboItem {
  producto: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface ReciboResponse {
  id: number;
  pagoHonorarioId?: number;
  clienteId?: number;
  nombreCliente: string;
  rtnCliente: string;
  tipoComprobante: 'SinCAI' | 'ConCAI';
  numeroRecibo: string;
  numeroFiscal?: string;
  cai?: string;
  rangoAutorizado?: string;
  fechaLimiteEmision?: string;
  fechaEmision: string;
  concepto: string;
  subtotal: number;
  impuesto: number;
  monto: number;
  montoEnLetras: string;
  metodoPago?: string;
  anulado: boolean;
  motivoAnulacion?: string;
  items: ReciboItem[];
}

export interface ReciboCreate {
  clienteId?: number | null;
  nombreCliente?: string;
  rtnCliente?: string;
  tipoComprobante: 'SinCAI' | 'ConCAI';
  numeroRecibo?: string;
  fechaEmision: string;
  concepto?: string;
  subtotal: number;
  impuesto: number;
  monto: number;
  metodoPago?: string;
  observaciones?: string;
  registrarComoPago?: boolean;
  mesAplicado?: string;
  items: ReciboItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiRecibosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/recibos`;

  getRecibos(): Observable<ReciboResponse[]> {
    return this.http.get<ReciboResponse[]>(this.apiUrl);
  }

  getReciboById(id: number): Observable<ReciboResponse> {
    return this.http.get<ReciboResponse>(`${this.apiUrl}/${id}`);
  }

  crearRecibo(data: ReciboCreate): Observable<ReciboResponse> {
    return this.http.post<ReciboResponse>(this.apiUrl, data);
  }

  anularRecibo(id: number, motivo?: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/${id}/anular`, motivo || 'Anulado por el usuario');
  }

  descargarReciboPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, { responseType: 'blob' });
  }
}
