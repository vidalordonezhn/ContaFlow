import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiImportExportService, ClienteImportItem, ImportacionResponse } from '../services/api-import-export.service';

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './import-export.component.html',
  styleUrl: './import-export.component.scss'
})
export class ImportExportComponent {
  private readonly importExportService = inject(ApiImportExportService);

  readonly parsedClientes = signal<ClienteImportItem[]>([]);
  readonly isDragging = signal(false);
  readonly fileName = signal<string | null>(null);
  readonly isImporting = signal(false);
  readonly importResult = signal<ImportacionResponse | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);

  // Tab activo dentro de Import / Export
  readonly activeTab = signal<'importar' | 'exportar'>('importar');

  // Estadísticas del archivo analizado
  readonly totalFilas = computed(() => this.parsedClientes().length);
  readonly filasValidas = computed(() => this.parsedClientes().filter(c => c.valido).length);
  readonly filasConError = computed(() => this.parsedClientes().filter(c => !c.valido).length);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.procesarArchivo(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.procesarArchivo(input.files[0]);
    }
  }

  procesarArchivo(file: File): void {
    this.fileName.set(file.name);
    this.errorMsg.set(null);
    this.importResult.set(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parsearCsv(text);
    };
    reader.onerror = () => {
      this.errorMsg.set('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file, 'UTF-8');
  }

  parsearCsv(csvText: string): void {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        this.errorMsg.set('El archivo está vacío o solo contiene encabezados.');
        this.parsedClientes.set([]);
        return;
      }

      const headers = this.parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
      const rtnIdx = headers.findIndex(h => h.includes('rtn'));
      const razonIdx = headers.findIndex(h => h.includes('razon') || h.includes('nombre'));
      const comercialIdx = headers.findIndex(h => h.includes('comercial'));
      const tipoIdx = headers.findIndex(h => h.includes('tipo') || h.includes('persona'));
      const rubroIdx = headers.findIndex(h => h.includes('rubro') || h.includes('giro'));
      const cuotaIdx = headers.findIndex(h => h.includes('cuota') || h.includes('monto') || h.includes('honorario'));
      const diaIdx = headers.findIndex(h => h.includes('dia') || h.includes('cobro'));
      const telIdx = headers.findIndex(h => h.includes('tel') || h.includes('whatsapp') || h.includes('cel'));
      const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('correo'));
      const dirIdx = headers.findIndex(h => h.includes('dir') || h.includes('direccion'));

      const parsed: ClienteImportItem[] = [];
      const seenRtns = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCsvLine(lines[i]);
        if (row.length === 0 || row.every(cell => !cell.trim())) continue;

        const rtn = rtnIdx >= 0 && row[rtnIdx] ? row[rtnIdx].replace(/[^0-9]/g, '').trim() : '';
        const razon = razonIdx >= 0 && row[razonIdx] ? row[razonIdx].trim() : '';
        const comercial = comercialIdx >= 0 && row[comercialIdx] ? row[comercialIdx].trim() : undefined;
        const tipo = tipoIdx >= 0 && row[tipoIdx] && row[tipoIdx].toLowerCase().includes('nat') ? 'Natural' : 'Juridica';
        const rubro = rubroIdx >= 0 && row[rubroIdx] ? row[rubroIdx].trim() : 'General';
        const cuotaRaw = cuotaIdx >= 0 && row[cuotaIdx] ? row[cuotaIdx].replace(/[^0-9.]/g, '') : '1500';
        const cuota = parseFloat(cuotaRaw) || 1500;
        const diaRaw = diaIdx >= 0 && row[diaIdx] ? parseInt(row[diaIdx].replace(/[^0-9]/g, ''), 10) : 5;
        const dia = diaRaw > 0 && diaRaw <= 31 ? diaRaw : 5;
        const tel = telIdx >= 0 && row[telIdx] ? row[telIdx].trim() : undefined;
        const email = emailIdx >= 0 && row[emailIdx] ? row[emailIdx].trim() : undefined;
        const dir = dirIdx >= 0 && row[dirIdx] ? row[dirIdx].trim() : undefined;

        let valido = true;
        let errorMsg = '';

        if (!rtn) {
          valido = false;
          errorMsg = 'Falta el RTN fiscal';
        } else if (rtn.length !== 14) {
          valido = false;
          errorMsg = `RTN inválido (${rtn.length} dígitos, se esperan 14)`;
        } else if (seenRtns.has(rtn)) {
          valido = false;
          errorMsg = 'RTN duplicado dentro del archivo';
        } else if (!razon) {
          valido = false;
          errorMsg = 'Falta la Razón Social / Nombre';
        }

        if (rtn) seenRtns.add(rtn);

        parsed.push({
          rtn,
          nombreRazonSocial: razon,
          nombreComercial: comercial,
          tipoPersona: tipo,
          rubro: rubro,
          cuotaMensual: cuota,
          diaCobro: dia,
          telefonoWhatsApp: tel,
          emailPrincipal: email,
          direccion: dir,
          valido,
          errorMsg: errorMsg || undefined
        });
      }

      this.parsedClientes.set(parsed);
    } catch {
      this.errorMsg.set('Error al interpretar el formato del archivo CSV.');
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  ejecutarImportacion(): void {
    const validos = this.parsedClientes().filter(c => c.valido);
    if (validos.length === 0) {
      this.errorMsg.set('No hay clientes válidos para importar.');
      return;
    }

    this.isImporting.set(true);
    this.errorMsg.set(null);

    this.importExportService.importarClientes(validos).subscribe({
      next: (res) => {
        this.importResult.set(res);
        this.isImporting.set(false);
        this.showToast(`¡Se importaron con éxito ${res.totalInsertados} clientes!`);
        this.parsedClientes.set([]);
        this.fileName.set(null);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.mensaje || 'Error al importar los clientes en el servidor.');
        this.isImporting.set(false);
      }
    });
  }

  descargarPlantilla(): void {
    this.importExportService.descargarPlantillaCsv().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Plantilla_Importacion_Clientes_ContaFlow.csv';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.errorMsg.set('No se pudo descargar la plantilla.')
    });
  }

  exportarClientes(): void {
    this.importExportService.exportarClientesCsv().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Directorio_Clientes_ContaFlow_${new Date().toISOString().substring(0, 10)}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.showToast('Descarga del padrón de clientes iniciada.');
      },
      error: () => this.errorMsg.set('Error al exportar clientes.')
    });
  }

  exportarPagos(): void {
    this.importExportService.exportarPagosCsv().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Historial_Pagos_ContaFlow_${new Date().toISOString().substring(0, 10)}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.showToast('Descarga del historial de pagos iniciada.');
      },
      error: () => this.errorMsg.set('Error al exportar pagos.')
    });
  }

  cancelarPrevisualizacion(): void {
    this.parsedClientes.set([]);
    this.fileName.set(null);
    this.errorMsg.set(null);
  }

  private showToast(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 4000);
  }
}
