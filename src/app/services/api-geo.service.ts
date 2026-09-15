import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MunicipioResponse {
  id: number;
  departamentoId: number;
  codigo: string;
  nombre: string;
}

export interface DepartamentoResponse {
  id: number;
  codigo: string;
  nombre: string;
  cabecera?: string;
  municipios: MunicipioResponse[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiGeoService {
  private readonly http = inject(HttpClient);

  readonly departamentos = signal<DepartamentoResponse[]>([]);
  readonly isLoaded = signal<boolean>(false);

  cargarDepartamentos(): Observable<DepartamentoResponse[]> {
    return this.http.get<DepartamentoResponse[]>(`${environment.apiUrl}/api/geo/departamentos`).pipe(
      tap((data) => {
        this.departamentos.set(data);
        this.isLoaded.set(true);
      })
    );
  }

  /**
   * Intenta resolver Departamento y Municipio a partir del código de 4 dígitos inicial
   * del RTN o DNI hondureño (ej. '0801' -> Francisco Morazán / Distrito Central).
   */
  detectarUbicacionPorRtnODni(codigoRtnODni: string): {
    departamentoId?: number;
    departamentoNombre?: string;
    municipioId?: number;
    municipioNombre?: string;
  } | null {
    if (!codigoRtnODni || codigoRtnODni.length < 4) return null;
    const cleanCode = codigoRtnODni.replace(/[^0-9]/g, '');
    if (cleanCode.length < 4) return null;

    const codMun = cleanCode.substring(0, 4); // ej: "0801"
    const codDep = cleanCode.substring(0, 2); // ej: "08"

    const deps = this.departamentos();
    const dep = deps.find(d => d.codigo === codDep);
    if (!dep) return null;

    const mun = dep.municipios.find(m => m.codigo === codMun);

    return {
      departamentoId: dep.id,
      departamentoNombre: dep.nombre,
      municipioId: mun ? mun.id : undefined,
      municipioNombre: mun ? mun.nombre : undefined
    };
  }
}
