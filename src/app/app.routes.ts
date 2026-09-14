import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { LayoutComponent } from './layout/layout.component';
import { DashboardHomeComponent } from './dashboard-home/dashboard-home.component';
import { ClientsComponent } from './clients/clients.component';
import { SARControlComponent } from './sar-control/sar-control.component';
import { PaymentsComponent } from './payments/payments.component';
import { ReceiptsComponent } from './receipts/receipts.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { UsuariosComponent } from './usuarios/usuarios.component';
import { ReportesComponent } from './reportes/reportes.component';
import { ImportExportComponent } from './import-export/import-export.component';
import { ConfiguracionComponent } from './configuracion/configuracion.component';
import { CalendarioFiscalComponent } from './calendario-fiscal/calendario-fiscal.component';
import { LibrosIsvComponent } from './libros-isv/libros-isv.component';
import { HistoricoIsvComponent } from './historico-isv/historico-isv.component';
import { authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginGuard]
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardHomeComponent },
      { path: 'clientes', component: ClientsComponent },
      { path: 'sar-control', component: SARControlComponent },
      { path: 'libros-isv', component: LibrosIsvComponent },
      { path: 'historico-isv', component: HistoricoIsvComponent },
      { path: 'calendario-fiscal', component: CalendarioFiscalComponent },
      { path: 'pagos', component: PaymentsComponent },
      { path: 'recibos', component: ReceiptsComponent },
      { path: 'facturacion', component: ReceiptsComponent },
      { path: 'notificaciones', component: NotificationsComponent },
      { path: 'usuarios', component: UsuariosComponent },
      { path: 'reportes', component: ReportesComponent },
      { path: 'import-export', component: ImportExportComponent },
      { path: 'configuracion', component: ConfiguracionComponent }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
