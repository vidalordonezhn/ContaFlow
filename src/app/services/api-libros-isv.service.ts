import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LibroIsvDetalle {
  id: number;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  mes: number;
  anio: number;
  mesNombre: string;
  facturasRecibidas: boolean;
  cantidadFacturasVenta: number;
  cantidadFacturasCompra: number;

  // Ventas
  ventasGravadas15: number;
  ventasGravadas18: number;
  ventasExentas: number;
  isvDebito15: number;
  isvDebito18: number;
  totalVentasNetas: number;
  totalDebitoFiscal: number;

  // Compras
  comprasGravadas15: number;
  comprasGravadas18: number;
  comprasExentas: number;
  importacionesGravadas15: number;
  isvCredito15: number;
  isvCredito18: number;
  totalComprasNetas: number;
  totalCreditoFiscal: number;

  // Liquidación SAR-210
  saldoAFavorPeriodoAnterior: number;
  retencionesISVRecibidas: number;
  impuestoDeterminadoPagar: number;
  saldoAFavorContribuyente: number;

  // Estado
  liquidadoSAR: boolean;
  fechaLiquidacion?: string;
  numeroDeclaracionSAR?: string;
  estado: string;
}

export interface LibroIsvGuardar {
  clienteId: number;
  mes: number;
  anio: number;
  ventasGravadas15: number;
  ventasGravadas18: number;
  ventasExentas: number;
  comprasGravadas15: number;
  comprasGravadas18: number;
  comprasExentas: number;
  importacionesGravadas15: number;
  saldoAFavorPeriodoAnterior: number;
  retencionesISVRecibidas: number;
  marcarComoLiquidado: boolean;
  numeroDeclaracionSAR?: string;
}

export interface LibroIsvImportItem {
  rtn: string;
  mes: number;
  anio: number;
  ventasGravadas15: number;
  ventasGravadas18: number;
  ventasExentas: number;
  comprasGravadas15: number;
  comprasGravadas18: number;
  comprasExentas: number;
  importacionesGravadas15: number;
  saldoAFavorPeriodoAnterior: number;
  retencionesISVRecibidas: number;
  numeroDeclaracionSAR?: string;
}

export interface LibroIsvImportResponse {
  totalProcesados: number;
  totalGuardados: number;
  totalErrores: number;
  mensajes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiLibrosIsvService {
  private readonly http = inject(HttpClient);

  getLibroIsv(clienteId: number, anio: number, mes: number): Observable<LibroIsvDetalle> {
    return this.http.get<LibroIsvDetalle>(`${environment.apiUrl}/api/librosisv/periodo/${clienteId}/${anio}/${mes}`);
  }

  guardarLibroIsv(dto: LibroIsvGuardar): Observable<LibroIsvDetalle> {
    return this.http.post<LibroIsvDetalle>(`${environment.apiUrl}/api/librosisv/guardar`, dto);
  }

  descargarPlantillaUrl(): string {
    return `${environment.apiUrl}/api/librosisv/plantilla`;
  }

  importarMasivo(items: LibroIsvImportItem[]): Observable<LibroIsvImportResponse> {
    return this.http.post<LibroIsvImportResponse>(`${environment.apiUrl}/api/librosisv/importar-masivo`, items);
  }

  exportarResumenMesUrl(anio: number, mes: number): string {
    return `${environment.apiUrl}/api/librosisv/exportar/${anio}/${mes}`;
  }
}
