import { Injectable, inject, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

export interface ModuloItem {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  category: 'Dashboard & SAR' | 'Clientes & Honorarios' | 'Administración & Alertas';
  route: string;
  iconPath: string;
  closable: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TabsService {
  private readonly router = inject(Router);

  // Catálogo completo de las 7 pantallas/módulos de ContaFlow
  readonly catalogoModulos: ModuloItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard SAR',
      shortTitle: 'Dashboard',
      description: 'Panel ejecutivo con resumen de clientes, semáforo SAR y recaudación.',
      category: 'Dashboard & SAR',
      route: '/dashboard',
      iconPath: 'dashboard',
      closable: false
    },
    {
      id: 'clientes',
      title: 'Directorio Clientes',
      shortTitle: 'Clientes',
      description: 'Directorio fiscal de contribuyentes, RTN, régimen SAR, cuotas y contactos.',
      category: 'Clientes & Honorarios',
      route: '/clientes',
      iconPath: 'people',
      closable: true
    },
    {
      id: 'sar-control',
      title: 'Control Fiscal SAR (Día 10)',
      shortTitle: 'Control SAR',
      description: 'Semáforo de compras/ventas, recepción de facturas y liquidación SAR.',
      category: 'Dashboard & SAR',
      route: '/sar-control',
      iconPath: 'event_note',
      closable: true
    },
    {
      id: 'libros-isv',
      title: 'Libros Compras y Ventas ISV (SAR-210)',
      shortTitle: 'Libros ISV',
      description: 'Liquidación de Débito/Crédito Fiscal, Renglones Oficiales SAR y Carga Masiva Excel.',
      category: 'Dashboard & SAR',
      route: '/libros-isv',
      iconPath: 'menu_book',
      closable: true
    },
    {
      id: 'historico-isv',
      title: 'Histórico & Auditoría ISV (SAR)',
      shortTitle: 'Histórico ISV',
      description: 'Consulta histórica anual de libros de compras, ventas y liquidaciones SAR por cliente.',
      category: 'Dashboard & SAR',
      route: '/historico-isv',
      iconPath: 'history',
      closable: true
    },
    {
      id: 'calendario-fiscal',
      title: 'Calendario Fiscal Anual (SAR)',
      shortTitle: 'Calendario SAR',
      description: 'Vencimientos anuales: ISR (Abril 30), Pagos a Cuenta trimestrales y Retenciones.',
      category: 'Dashboard & SAR',
      route: '/calendario-fiscal',
      iconPath: 'calendar_month',
      closable: true
    },
    {
      id: 'pagos',
      title: 'Honorarios y Pagos',
      shortTitle: 'Honorarios',
      description: 'Cobranza mensual, registro de pagos y estado de cuenta.',
      category: 'Clientes & Honorarios',
      route: '/pagos',
      iconPath: 'receipt_long',
      closable: true
    },
    {
      id: 'recibos',
      title: 'Facturación y Recibos',
      shortTitle: 'Facturación',
      description: 'Emisión de Facturas SAR con CAI y Recibos informales con desglose de servicios e ítems.',
      category: 'Clientes & Honorarios',
      route: '/recibos',
      iconPath: 'description',
      closable: true
    },
    {
      id: 'notificaciones',
      title: 'Recordatorios SAR',
      shortTitle: 'Recordatorios',
      description: 'Centro de avisos por WhatsApp y correos preventivos antes del día 10.',
      category: 'Administración & Alertas',
      route: '/notificaciones',
      iconPath: 'notifications_active',
      closable: true
    },
    {
      id: 'usuarios',
      title: 'Usuarios y Empleados',
      shortTitle: 'Personal',
      description: 'Gestión de contadores, asistentes contables y control de accesos.',
      category: 'Administración & Alertas',
      route: '/usuarios',
      iconPath: 'badge',
      closable: true
    },
    {
      id: 'reportes',
      title: 'Reportes Financieros',
      shortTitle: 'Reportes',
      description: 'Evolución de ingresos, salud de cartera al día vs morosos y gráficos.',
      category: 'Dashboard & SAR',
      route: '/reportes',
      iconPath: 'insights',
      closable: true
    },
    {
      id: 'import-export',
      title: 'Importar / Exportar',
      shortTitle: 'Excel / CSV',
      description: 'Carga masiva de clientes desde Excel y exportación de respaldos.',
      category: 'Administración & Alertas',
      route: '/import-export',
      iconPath: 'import_export',
      closable: true
    },
    {
      id: 'configuracion',
      title: 'Perfil y Branding Despacho',
      shortTitle: 'Configuración',
      description: 'Datos fiscales, logotipo, colegiación CAH y cuentas bancarias en recibos PDF.',
      category: 'Administración & Alertas',
      route: '/configuracion',
      iconPath: 'settings',
      closable: true
    }
  ];

  // Pestañas abiertas inicialmente
  readonly tabs = signal<ModuloItem[]>([this.catalogoModulos[0]]);
  readonly activeTabId = signal<string>('dashboard');

  // Command Palette
  readonly searchOpen = signal<boolean>(false);
  readonly searchQuery = signal<string>('');

  readonly modulosFiltrados = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.catalogoModulos;
    return this.catalogoModulos.filter(m =>
      m.title.toLowerCase().includes(query) ||
      m.shortTitle.toLowerCase().includes(query) ||
      m.description.toLowerCase().includes(query) ||
      m.category.toLowerCase().includes(query)
    );
  });

  readonly modulosAgrupados = computed(() => {
    const filtrados = this.modulosFiltrados();
    const categorias: Record<string, ModuloItem[]> = {};

    for (const m of filtrados) {
      if (!categorias[m.category]) {
        categorias[m.category] = [];
      }
      categorias[m.category].push(m);
    }

    return Object.keys(categorias).map(cat => ({
      categoria: cat,
      items: categorias[cat]
    }));
  });

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.syncTabFromUrl(event.urlAfterRedirects || event.url);
    });
  }

  openModulo(modulo: ModuloItem): void {
    const currentTabs = this.tabs();
    const yaAbierta = currentTabs.find(t => t.id === modulo.id);

    if (!yaAbierta) {
      this.tabs.set([...currentTabs, modulo]);
    }

    this.activeTabId.set(modulo.id);
    this.closeSearch();
    this.router.navigate([modulo.route]);
  }

  selectTab(tabId: string): void {
    const target = this.tabs().find(t => t.id === tabId);
    if (target) {
      this.activeTabId.set(tabId);
      this.router.navigate([target.route]);
    }
  }

  closeTab(tabId: string, event?: Event): void {
    if (event) event.stopPropagation();

    const currentTabs = this.tabs();
    const tabToClose = currentTabs.find(t => t.id === tabId);
    if (!tabToClose || !tabToClose.closable) return;

    const newTabs = currentTabs.filter(t => t.id !== tabId);
    this.tabs.set(newTabs);

    if (this.activeTabId() === tabId) {
      const fallbackTab = newTabs[newTabs.length - 1] || this.catalogoModulos[0];
      this.selectTab(fallbackTab.id);
    }
  }

  isTabOpen(moduloId: string): boolean {
    return this.tabs().some(t => t.id === moduloId);
  }

  openSearch(): void {
    this.searchQuery.set('');
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.searchQuery.set('');
  }

  toggleSearch(): void {
    if (this.searchOpen()) this.closeSearch();
    else this.openSearch();
  }

  private syncTabFromUrl(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];

    let matched = this.catalogoModulos.find(m => {
      if (m.route === '/dashboard') {
        return cleanUrl === '' || cleanUrl === '/' || cleanUrl === '/dashboard';
      }
      return cleanUrl === m.route || cleanUrl.startsWith(m.route + '/');
    });

    if (!matched) {
      matched = this.catalogoModulos[0];
    }

    const currentTabs = this.tabs();
    if (!currentTabs.some(t => t.id === matched.id)) {
      this.tabs.set([...currentTabs, matched]);
    }

    this.activeTabId.set(matched.id);
  }
}
