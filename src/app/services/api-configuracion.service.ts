import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ConfiguracionDespacho {
  id: number;
  nombreDespacho: string;
  nombreContadorTitular: string;
  colegiacionCAH: string;
  rtnDespacho: string;
  telefono: string;
  telefonoWhatsApp: string;
  email: string;
  direccion: string;
  ciudad: string;
  slogan: string;
  logoBase64?: string | null;
  mensajePieRecibo: string;

  // Bancos
  banco1Activo: boolean;
  banco1Nombre: string;
  banco1TipoCuenta: string;
  banco1Numero: string;
  banco1Beneficiario: string;

  banco2Activo: boolean;
  banco2Nombre: string;
  banco2TipoCuenta: string;
  banco2Numero: string;
  banco2Beneficiario: string;

  banco3Activo: boolean;
  banco3Nombre: string;
  banco3TipoCuenta: string;
  banco3Numero: string;
  banco3Beneficiario: string;

  banco4Activo: boolean;
  banco4Nombre: string;
  banco4TipoCuenta: string;
  banco4Numero: string;
  banco4Beneficiario: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/configuracion`;

  getConfiguracion(): Observable<ConfiguracionDespacho> {
    return this.http.get<ConfiguracionDespacho>(this.apiUrl);
  }

  updateConfiguracion(data: Partial<ConfiguracionDespacho>): Observable<ConfiguracionDespacho> {
    return this.http.put<ConfiguracionDespacho>(this.apiUrl, data);
  }

  updateLogo(logoBase64: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/logo`, { logoBase64 });
  }

  removeLogo(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/logo`);
  }
}
