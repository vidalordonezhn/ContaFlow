import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HitoFiscal {
  codigo: string;
  titulo: string;
  formularioSAR: string;
  descripcion: string;
  fechaVencimiento: string;
  diaVencimiento: number;
  mesVencimiento: number;
  mesNombre: string;
  tipoPeriodicidad: string;
  color: string;
  diasRestantes: number;
  estaVencido: boolean;
  totalClientes: number;
  declaradosCount: number;
  enProcesoCount: number;
  pendientesCount: number;
  noAplicaCount: number;
  porcentajeCumplimiento: number;
}

export interface CalendarioFiscalResumen {
  anio: number;
  hitos: HitoFiscal[];
  proximoHito?: HitoFiscal;
}

export interface ClienteSeguimiento {
  clienteId: number;
  nombreRazonSocial: string;
  nombreComercial?: string;
  rtn: string;
  tipoPersona: string;
  rubro?: string;
  telefonoWhatsApp?: string;
  email?: string;
  anio: number;
  tipoObligacion: string;
  seguimientoId?: number;
  estado: 'Pendiente' | 'EnProceso' | 'Declarado' | 'NoAplica';
  montoDeclarado?: number;
  numeroDeclaracionSAR?: string;
  fechaCumplimiento?: string;
  observaciones?: string;
}

export interface ActualizarSeguimientoDto {
  clienteId: number;
  anio: number;
  tipoObligacion: string;
  estado: string;
  montoDeclarado?: number;
  numeroDeclaracionSAR?: string;
  fechaCumplimiento?: string;
  observaciones?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiCalendarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/calendariofiscal`;

  getCalendarioAnual(anio: number): Observable<CalendarioFiscalResumen> {
    return this.http.get<CalendarioFiscalResumen>(`${this.apiUrl}/${anio}`);
  }

  getClientesPorObligacion(anio: number, codigo: string): Observable<ClienteSeguimiento[]> {
    return this.http.get<ClienteSeguimiento[]>(`${this.apiUrl}/${anio}/obligacion/${codigo}`);
  }

  actualizarEstado(dto: ActualizarSeguimientoDto): Observable<{ message: string; id: number }> {
    return this.http.put<{ message: string; id: number }>(`${this.apiUrl}/actualizar-estado`, dto);
  }
}
