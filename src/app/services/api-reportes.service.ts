import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IngresoMensualItem {
  mesNombre: string;
  mesNumero: number;
  anio: number;
  montoTotal: number;
  cantidadPagos: number;
}

export interface DistribucionItem {
  etiqueta: string;
  cantidadClientes: number;
  totalCuotas: number;
  porcentaje: number;
}

export interface ReporteFinancieroResponse {
  totalRecaudadoHistorico: number;
  totalFacturableMensual: number;
  recaudadoMesActual: number;
  pendienteCobroMesActual: number;
  porcentajeCobranzaMesActual: number;
  totalClientesActivos: number;
  clientesAlDiaCount: number;
  clientesMorososCount: number;
  porcentajeClientesAlDia: number;
  historicoIngresos: IngresoMensualItem[];
  distribucionPorTipoPersona: DistribucionItem[];
  distribucionPorRubro: DistribucionItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiReportesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reportes`;

  getReporteFinanciero(): Observable<ReporteFinancieroResponse> {
    return this.http.get<ReporteFinancieroResponse>(`${this.apiUrl}/financieros`);
  }
}
