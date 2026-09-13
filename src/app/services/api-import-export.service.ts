import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClienteImportItem {
  rtn: string;
  nombreRazonSocial: string;
  nombreComercial?: string;
  tipoPersona: string;
  rubro?: string;
  emailPrincipal?: string;
  telefonoWhatsApp?: string;
  direccion?: string;
  cuotaMensual: number;
  diaCobro: number;
  notas?: string;
  // UI validation fields
  valido?: boolean;
  errorMsg?: string;
}

export interface ImportacionResponse {
  totalProcesados: number;
  totalInsertados: number;
  totalOmitidosPorDuplicado: number;
  totalErrores: number;
  mensajes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiImportExportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/importexport`;

  descargarPlantillaCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/plantilla-clientes`, {
      responseType: 'blob'
    });
  }

  importarClientes(clientes: ClienteImportItem[]): Observable<ImportacionResponse> {
    return this.http.post<ImportacionResponse>(`${this.apiUrl}/importar-clientes`, clientes);
  }

  exportarClientesCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/exportar-clientes`, {
      responseType: 'blob'
    });
  }

  exportarPagosCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/exportar-pagos`, {
      responseType: 'blob'
    });
  }
}
