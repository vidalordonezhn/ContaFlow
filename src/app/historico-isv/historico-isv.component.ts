import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import * as XLSX from 'xlsx';
import {
  ApiLibrosIsvService,
  ResumenHistoricoCliente,
  PeriodoHistoricoCliente,
  LibroCompletoMensual
} from '../services/api-libros-isv.service';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { ClientSelectorComponent } from '../shared/client-selector/client-selector.component';

@Component({
  selector: 'app-historico-isv',
  standalone: true,
  imports: [CommonModule, FormsModule, ClientSelectorComponent],
  templateUrl: './historico-isv.component.html',
  styleUrl: './historico-isv.component.scss'
})
export class HistoricoIsvComponent implements OnInit {
  private readonly librosService = inject(ApiLibrosIsvService);
  private readonly clientsService = inject(ApiClientsService);
  private readonly pdfService = inject(PdfGeneratorService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Clientes y Selección
  readonly clientes = signal<ClienteResponse[]>([]);
  readonly selectedClienteId = signal<number | null>(null);
  readonly selectedCliente = computed(() => {
    const id = this.selectedClienteId();
    if (!id) return null;
    return this.clientes().find(c => Number(c.id) === Number(id)) || null;
  });

  // Filtros de Fecha
  readonly selectedAnio = signal<number>(new Date().getFullYear());
  readonly selectedMes = signal<number>(new Date().getMonth() + 1);
  readonly aniosList = [2024, 2025, 2026, 2027];

  // Estados de carga y datos
  readonly isLoadingHistorico = signal(false);
  readonly isLoadingDetalle = signal(false);
  readonly resumenHistorico = signal<ResumenHistoricoCliente | null>(null);
  readonly detalleMensual = signal<LibroCompletoMensual | null>(null);
  readonly activeDetailTab = signal<'ventas' | 'compras' | 'liquidacion'>('ventas');

  // Meses disponibles
  readonly mesesList = [
    { num: 1, nombre: 'Enero', corto: 'ENE' },
    { num: 2, nombre: 'Febrero', corto: 'FEB' },
    { num: 3, nombre: 'Marzo', corto: 'MAR' },
    { num: 4, nombre: 'Abril', corto: 'ABR' },
    { num: 5, nombre: 'Mayo', corto: 'MAY' },
    { num: 6, nombre: 'Junio', corto: 'JUN' },
    { num: 7, nombre: 'Julio', corto: 'JUL' },
    { num: 8, nombre: 'Agosto', corto: 'AGO' },
    { num: 9, nombre: 'Septiembre', corto: 'SEP' },
    { num: 10, nombre: 'Octubre', corto: 'OCT' },
    { num: 11, nombre: 'Noviembre', corto: 'NOV' },
    { num: 12, nombre: 'Diciembre', corto: 'DIC' }
  ];

  readonly selectedMesNombre = computed(() => {
    return this.mesesList.find(m => m.num === this.selectedMes())?.nombre || 'Mes';
  });

  readonly periodoSeleccionado = computed<PeriodoHistoricoCliente | null>(() => {
    const historico = this.resumenHistorico();
    if (!historico) return null;
    return historico.periodos.find(p => p.mes === this.selectedMes()) || null;
  });

  ngOnInit(): void {
    this.cargarClientes();
    this.route.queryParams.subscribe(params => {
      if (params['clienteId']) {
        this.selectedClienteId.set(Number(params['clienteId']));
      }
      if (params['anio']) {
        this.selectedAnio.set(Number(params['anio']));
      }
      if (params['mes']) {
        this.selectedMes.set(Number(params['mes']));
      }
      if (this.selectedClienteId()) {
        this.consultarHistorico();
      }
    });
  }

  cargarClientes(): void {
    this.clientsService.getClientes().subscribe({
      next: (data) => {
        this.clientes.set(data || []);
        if (this.selectedClienteId() && !this.resumenHistorico()) {
          this.consultarHistorico();
        }
      },
      error: (err) => console.error('Error al cargar clientes:', err)
    });
  }

  onClientSelected(client: ClienteResponse): void {
    if (!client) return;
    this.selectedClienteId.set(Number(client.id));
    this.consultarHistorico();
  }

  onClientCleared(): void {
    this.selectedClienteId.set(null);
    this.resumenHistorico.set(null);
    this.detalleMensual.set(null);
  }

  onAnioChange(): void {
    if (this.selectedClienteId()) {
      this.consultarHistorico();
    }
  }

  consultarHistorico(): void {
    const cid = this.selectedClienteId();
    if (!cid) return;

    this.isLoadingHistorico.set(true);
    const anio = this.selectedAnio();

    this.librosService.getHistoricoCliente(cid, anio).subscribe({
      next: (data) => {
        this.resumenHistorico.set(data);
        this.isLoadingHistorico.set(false);
        this.cargarDetalleMes(this.selectedMes());
      },
      error: (err) => {
        console.error('Error al cargar histórico:', err);
        this.isLoadingHistorico.set(false);
      }
    });
  }

  seleccionarMes(mes: number): void {
    this.selectedMes.set(mes);
    this.cargarDetalleMes(mes);
  }

  cargarDetalleMes(mes: number): void {
    const cid = this.selectedClienteId();
    if (!cid) return;

    this.isLoadingDetalle.set(true);
    this.librosService.getLibroCompleto(cid, this.selectedAnio(), mes).subscribe({
      next: (data) => {
        this.detalleMensual.set(data);
        this.isLoadingDetalle.set(false);
      },
      error: (err) => {
        console.error('Error al cargar detalle del mes:', err);
        this.detalleMensual.set(null);
        this.isLoadingDetalle.set(false);
      }
    });
  }

  irAEditorLibros(): void {
    const cid = this.selectedClienteId();
    if (!cid) return;
    this.router.navigate(['/libros-isv'], {
      queryParams: {
        clienteId: cid,
        mes: this.selectedMes(),
        anio: this.selectedAnio()
      }
    });
  }

  descargarPdfOficial(): void {
    const d = this.detalleMensual();
    if (!d) return;

    this.pdfService.generarLibroDualPdf({
      cliente: {
        nombreRazonSocial: d.clienteNombre,
        rtn: d.clienteRtn,
        cuotaMensual: d.cuotaHonorarios
      },
      mesNombre: d.mesNombre,
      mes: d.mes,
      anio: d.anio,
      ventas: d.ventasItems,
      compras: d.comprasItems,
      resumenVentas: d.resumenVentas,
      resumenCompras: d.resumenCompras,
      liquidacion: d.liquidacion
    });
  }

  exportarExcel(): void {
    const d = this.detalleMensual();
    if (!d) return;

    this.pdfService.exportarLibroDualExcel({
      cliente: {
        nombreRazonSocial: d.clienteNombre,
        rtn: d.clienteRtn,
        cuotaMensual: d.cuotaHonorarios
      },
      mesNombre: d.mesNombre,
      mes: d.mes,
      anio: d.anio,
      ventas: d.ventasItems,
      compras: d.comprasItems,
      resumenVentas: d.resumenVentas,
      resumenCompras: d.resumenCompras,
      liquidacion: d.liquidacion
    });
  }
}
