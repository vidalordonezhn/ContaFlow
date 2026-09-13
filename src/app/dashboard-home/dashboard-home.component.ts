import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiClientsService, ClienteResponse } from '../services/api-clients.service';
import { ApiSARService, SARResumenMensual } from '../services/api-sar.service';
import { ApiPagosService, PagoResponse } from '../services/api-pagos.service';
import { ApiCalendarioService, HitoFiscal } from '../services/api-calendario.service';
import { TabsService } from '../services/tabs.service';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.scss'
})
export class DashboardHomeComponent implements OnInit {
  private readonly clientsService = inject(ApiClientsService);
  private readonly sarService = inject(ApiSARService);
  private readonly pagosService = inject(ApiPagosService);
  private readonly calendarioService = inject(ApiCalendarioService);
  protected readonly tabsService = inject(TabsService);

  readonly clientes = signal<ClienteResponse[]>([]);
  readonly resumenSAR = signal<SARResumenMensual | null>(null);
  readonly pagos = signal<PagoResponse[]>([]);
  readonly proximoHito = signal<HitoFiscal | null>(null);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.isLoading.set(true);
    const anioActual = new Date().getFullYear();
    this.clientsService.getClientes().subscribe(c => this.clientes.set(c));
    this.sarService.getResumen().subscribe(s => this.resumenSAR.set(s));
    this.calendarioService.getCalendarioAnual(anioActual).subscribe(cal => {
      if (cal.proximoHito) this.proximoHito.set(cal.proximoHito);
    });
    this.pagosService.getPagos().subscribe(p => {
      this.pagos.set(p);
      this.isLoading.set(false);
    });
  }
}
