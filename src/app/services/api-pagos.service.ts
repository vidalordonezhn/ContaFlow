import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PagoResponse {
  id: number;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  monto: number;
  fechaPago: string;
  metodoPago: string;
  referenciaBancaria?: string;
  mesAplicado: string;
  estado: string;
  observaciones?: string;
  reciboId?: number;
  numeroRecibo?: string;
}

export interface PagoCreate {
  clienteId: number;
  monto: number;
  fechaPago: string;
  metodoPago: string;
  referenciaBancaria?: string;
  mesAplicado: string;
  observaciones?: string;
  generarRecibo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiPagosService {
  private readonly http = inject(HttpClient);

  getPagos(): Observable<PagoResponse[]> {
    return this.http.get<PagoResponse[]>(`${environment.apiUrl}/api/pagos`);
  }

  registrarPago(pago: PagoCreate): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(`${environment.apiUrl}/api/pagos`, pago);
  }

  descargarReciboPdf(reciboId: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/api/recibos/${reciboId}/pdf`, { responseType: 'blob' });
  }
}
