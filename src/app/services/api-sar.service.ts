import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PeriodoSARResponse {
  id: number;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  clienteRubro?: string;
  clienteWhatsApp?: string;
  clienteEmail?: string;
  mes: number;
  anio: number;
  mesNombre: string;
  facturasRecibidas: boolean;
  fechaRecepcionFacturas?: string;
  cantidadFacturasVenta: number;
  cantidadFacturasCompra: number;
  notasDocumentos?: string;
  liquidadoSAR: boolean;
  fechaLiquidacion?: string;
  montoImpuestoISV?: number;
  montoRetenciones?: number;
  numeroDeclaracionSAR?: string;
  estado: string;
  nivelSemaforo: 'Verde' | 'Amarillo' | 'Rojo';
}

export interface SARResumenMensual {
  mes: number;
  anio: number;
  totalClientesActivos: number;
  facturasRecibidasCount: number;
  facturasPendientesCount: number;
  liquidadosSARCount: number;
  diasRestantesParaDia10: number;
  alertaDia10Proximo: boolean;
}

export interface MarcarRecepcion {
  facturasRecibidas: boolean;
  cantidadFacturasVenta: number;
  cantidadFacturasCompra: number;
  notasDocumentos?: string;
}

export interface RegistrarLiquidacionSAR {
  numeroDeclaracionSAR: string;
  montoImpuestoISV: number;
  montoRetenciones: number;
  notas?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiSARService {
  private readonly http = inject(HttpClient);

  getPeriodos(mes?: number, anio?: number): Observable<PeriodoSARResponse[]> {
    let params = new HttpParams();
    if (mes) params = params.set('mes', mes.toString());
    if (anio) params = params.set('anio', anio.toString());
    return this.http.get<PeriodoSARResponse[]>(`${environment.apiUrl}/api/sarcontrol`, { params });
  }

  getResumen(mes?: number, anio?: number): Observable<SARResumenMensual> {
    let params = new HttpParams();
    if (mes) params = params.set('mes', mes.toString());
    if (anio) params = params.set('anio', anio.toString());
    return this.http.get<SARResumenMensual>(`${environment.apiUrl}/api/sarcontrol/resumen`, { params });
  }

  marcarRecepcion(id: number, dto: MarcarRecepcion): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/api/sarcontrol/${id}/recepcion`, dto);
  }

  registrarLiquidacion(id: number, dto: RegistrarLiquidacionSAR): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/api/sarcontrol/${id}/liquidacion`, dto);
  }
}
