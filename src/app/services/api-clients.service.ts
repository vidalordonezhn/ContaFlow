import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClienteResponse {
  id: number;
  rtn: string;
  nombreRazonSocial: string;
  nombreComercial?: string;
  tipoPersona: string;
  rubro?: string;
  emailPrincipal?: string;
  emailSecundario?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  direccion?: string;
  cuotaMensual: number;
  diaCobro: number;
  contrasenaSAR?: string;
  activo: boolean;
  notas?: string;
  fechaCreacion: string;
  totalPagado: number;
  pagosRealizadosCount: number;
  facturasMesActualRecibidas: boolean;
}

export interface ClienteCreate {
  rtn: string;
  nombreRazonSocial: string;
  nombreComercial?: string;
  tipoPersona: string;
  rubro?: string;
  contrasenaSAR?: string;
  emailPrincipal?: string;
  emailSecundario?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  direccion?: string;
  cuotaMensual: number;
  diaCobro: number;
  notas?: string;
}

export interface ClienteUpdate {
  rtn?: string;
  nombreRazonSocial: string;
  nombreComercial?: string;
  tipoPersona: string;
  rubro?: string;
  contrasenaSAR?: string;
  emailPrincipal?: string;
  emailSecundario?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  direccion?: string;
  cuotaMensual: number;
  diaCobro: number;
  activo: boolean;
  notas?: string;
}

export interface DeclaracionAnualItem {
  id: number;
  anio: number;
  tipoObligacion: string;
  titulo: string;
  formularioSAR: string;
  estado: string;
  montoDeclarado?: number;
  numeroDeclaracionSAR?: string;
  fechaCumplimiento?: string;
  observaciones?: string;
}

export interface PeriodoMensualItem {
  id: number;
  mes: number;
  anio: number;
  mesNombre: string;
  facturasRecibidas: boolean;
  fechaRecepcionFacturas?: string;
  cantidadFacturasVenta?: number;
  cantidadFacturasCompra?: number;
  liquidadoSAR: boolean;
  fechaLiquidacion?: string;
  numeroDeclaracionSAR?: string;
  montoImpuestoISV?: number;
  estado: string;
}

export interface ComprobanteItem {
  reciboId: number;
  numeroRecibo: string;
  numeroFiscal?: string;
  cai?: string;
  monto: number;
  montoEnLetras: string;
  fechaEmision: string;
  concepto: string;
  metodoPago: string;
  mesAplicado: string;
}

export interface ExpedienteFiscal {
  cliente: ClienteResponse;
  declaracionesAnuales: DeclaracionAnualItem[];
  declaracionesMensualesISV: PeriodoMensualItem[];
  comprobantesEmitidos: ComprobanteItem[];
  totalDeclaracionesPresentadas: number;
  totalImpuestoLiquidadoSAR: number;
  totalHonorariosPagados: number;
}

export interface ClienteImportItem {
  rtn: string;
  nombreRazonSocial: string;
  nombreComercial?: string;
  tipoPersona?: string;
  rubro?: string;
  contrasenaSAR?: string;
  emailPrincipal?: string;
  emailSecundario?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  direccion?: string;
  cuotaMensual?: number;
  diaCobro?: number;
  notas?: string;
}

export interface ClienteImportResponse {
  totalProcesados: number;
  totalGuardados: number;
  totalActualizados: number;
  totalErrores: number;
  mensajes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiClientsService {
  private readonly http = inject(HttpClient);

  getClientes(): Observable<ClienteResponse[]> {
    return this.http.get<ClienteResponse[]>(`${environment.apiUrl}/api/clientes`);
  }

  getClienteById(id: number): Observable<ClienteResponse> {
    return this.http.get<ClienteResponse>(`${environment.apiUrl}/api/clientes/${id}`);
  }

  getExpedienteFiscal(id: number): Observable<ExpedienteFiscal> {
    return this.http.get<ExpedienteFiscal>(`${environment.apiUrl}/api/clientes/${id}/expediente`);
  }

  crearCliente(cliente: ClienteCreate): Observable<ClienteResponse> {
    return this.http.post<ClienteResponse>(`${environment.apiUrl}/api/clientes`, cliente);
  }

  actualizarCliente(id: number, cliente: ClienteUpdate): Observable<ClienteResponse> {
    return this.http.put<ClienteResponse>(`${environment.apiUrl}/api/clientes/${id}`, cliente);
  }

  toggleStatus(id: number): Observable<any> {
    return this.http.patch<any>(`${environment.apiUrl}/api/clientes/${id}/toggle-status`, {});
  }

  importarMasivo(items: ClienteImportItem[]): Observable<ClienteImportResponse> {
    return this.http.post<ClienteImportResponse>(`${environment.apiUrl}/api/clientes/importar-masivo`, items);
  }

  descargarPlantillaUrl(): string {
    return `${environment.apiUrl}/api/clientes/plantilla`;
  }
}

