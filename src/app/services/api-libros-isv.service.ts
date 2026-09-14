import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LibroIsvDetalle {
  id: number;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  clienteContrasenaSAR?: string;
  cuotaHonorarios?: number;
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

export interface LibroPartidaItem {
  id?: number;
  correlativo: number;
  fecha?: string; // yyyy-MM-dd
  proveedor?: string;

  // Compras
  comprasExentas: number;
  comprasGravadas: number;
  isvCompras15: number;
  facturaNumero?: string;

  // Ventas
  ventasExentas: number;
  ventasGravadas: number;
  isvVentas15: number;
  notas?: string;
}

export interface LibroDetalleCompleto {
  periodoFiscalId: number;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  clienteContrasenaSAR?: string;
  cuotaHonorarios: number;
  mes: number;
  anio: number;
  mesNombre: string;

  items: LibroPartidaItem[];

  // Totales
  totalComprasExentas: number;
  totalComprasGravadas: number;
  totalIsvCompras15: number;

  totalVentasExentas: number;
  totalVentasGravadas: number;
  totalIsvVentas15: number;

  // Resumen
  impuestoCompras: number;
  impuestoVentas: number;
  impuestoAPagar: number;
  saldoAFavor: number;
  serviciosProfesionales: number;
  totalAPagarLps: number;
}

export interface GuardarLibroDetallePartidas {
  clienteId: number;
  mes: number;
  anio: number;
  serviciosProfesionales?: number;
  items: LibroPartidaItem[];
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

// === MODELOS OFICIALES PARA FORMATO DUAL EJEMPLO.XLSX ===

export interface LibroVentaItem {
  id?: number;
  correlativo: number;
  fecha?: string; // yyyy-MM-dd
  factura?: string;
  exonerado: number;
  exento: number;
  gravado15: number;
  gravado18: number;
  isv15: number;
  isv18: number;
  total: number;
  notas?: string;
}

export interface LibroCompraItem {
  id?: number;
  correlativo: number;
  fecha?: string; // yyyy-MM-dd
  factura?: string;
  proveedor?: string;
  exonerado: number;
  exento: number;
  gravado15: number;
  gravado18: number;
  isv15: number;
  isv18: number;
  total: number;
  notas?: string;
}

export interface ResumenVentasCasillas {
  totalExonerado: number;
  totalExento: number;
  totalGravado15: number;
  totalGravado18: number;
  totalIsv15: number;
  totalIsv18: number;
  totalDebitoFiscal: number;
  totalGeneral: number;
}

export interface ResumenComprasCasillas {
  totalExonerado: number;
  totalExento: number;
  totalGravado15: number;
  totalGravado18: number;
  totalIsv15: number;
  totalIsv18: number;
  totalCreditoFiscal: number;
  totalGeneral: number;
}

export interface LiquidacionConsolidada {
  debitoFiscalVentas: number;
  creditoFiscalCompras: number;
  diferenciaIsv: number;
  saldoAFavorPeriodoAnterior: number;
  retenciones15: number;
  retenciones18: number;
  totalRetenciones: number;
  liquidacionFinalPagar: number;
  saldoAFavorContribuyente: number;
  serviciosProfesionales: number;
  totalPagarLps: number;
}

export interface LibroCompletoMensual {
  periodoFiscalId: number;
  clienteId: number;
  clienteNombre: string;
  clienteRtn: string;
  clienteContrasenaSAR?: string;
  cuotaHonorarios: number;
  mes: number;
  anio: number;
  mesNombre: string;

  ventasItems: LibroVentaItem[];
  comprasItems: LibroCompraItem[];

  resumenVentas: ResumenVentasCasillas;
  resumenCompras: ResumenComprasCasillas;
  liquidacion: LiquidacionConsolidada;

  liquidadoSAR: boolean;
  fechaLiquidacion?: string;
  numeroDeclaracionSAR?: string;
  estado: string;
}

export interface GuardarLibroCompletoRequest {
  clienteId: number;
  mes: number;
  anio: number;
  saldoAFavorPeriodoAnterior: number;
  retenciones15: number;
  retenciones18: number;
  serviciosProfesionales?: number;
  marcarComoLiquidado: boolean;
  numeroDeclaracionSAR?: string;

  ventasItems: LibroVentaItem[];
  comprasItems: LibroCompraItem[];
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

  // Endpoints Hoja de Trabajo Detallada (Partida por Partida)
  getLibroDetalle(clienteId: number, anio: number, mes: number): Observable<LibroDetalleCompleto> {
    return this.http.get<LibroDetalleCompleto>(`${environment.apiUrl}/api/librosisv/detalle/${clienteId}/${anio}/${mes}`);
  }

  guardarLibroDetalle(dto: GuardarLibroDetallePartidas): Observable<LibroDetalleCompleto> {
    return this.http.post<LibroDetalleCompleto>(`${environment.apiUrl}/api/librosisv/detalle/guardar`, dto);
  }

  descargarPlantillaDetalleUrl(): string {
    return `${environment.apiUrl}/api/librosisv/detalle/plantilla`;
  }

  importarDetalleCsv(clienteId: number, anio: number, mes: number, csvContent: string): Observable<LibroDetalleCompleto> {
    return this.http.post<LibroDetalleCompleto>(`${environment.apiUrl}/api/librosisv/detalle/importar-csv`, {
      clienteId,
      anio,
      mes,
      csvContent
    });
  }

  // === MÉTODOS LIBRO COMPLETO DUAL (EJEMPLO.XLSX) ===
  getLibroCompleto(clienteId: number, anio: number, mes: number): Observable<LibroCompletoMensual> {
    return this.http.get<LibroCompletoMensual>(`${environment.apiUrl}/api/librosisv/libro-completo/${clienteId}/${anio}/${mes}`);
  }

  guardarLibroCompleto(req: GuardarLibroCompletoRequest): Observable<LibroCompletoMensual> {
    return this.http.post<LibroCompletoMensual>(`${environment.apiUrl}/api/librosisv/libro-completo/guardar`, req);
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
