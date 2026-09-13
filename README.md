# 💼 ContaFlow (Frontend Web)

Plataforma web moderna para despachos contables y contadores independientes en Honduras. Diseñada para automatizar el control de clientes, facturación fiscal CAI, calendario de obligaciones tributarias SAR y el cálculo del formulario **SAR-210 (Libros de Compras y Ventas ISV)**.

---

## 🌟 Características

- **📊 Dashboard Ejecutivo:** Visualización en tiempo real de ingresos por cuotas, clientes activos, porcentaje de cobro mensual y alertas fiscales.
- **👥 Gestión Integral de Clientes:**
  - Registro de Personas Naturales y Jurídicas con validación de RTN hondureño.
  - Asignación de cuotas mensuales y días de cobro programados.
- **🧾 Facturación y Control CAI:**
  - Emisión de recibos y facturas con correlativo fiscal oficial (`000-001-01-XXXXXXXX`).
  - Alertas automáticas de vencimiento por fecha límite y proximidad de agotamiento de rango.
- **📅 Calendario Fiscal Hondureño:**
  - Control del vencimiento mensual del Día 10 (ISV / Retenciones).
  - Vencimientos anuales: ISR (30 de abril), Pagos a Cuenta (Junio, Septiembre, Diciembre) y Declaración Anual de Retenciones (31 de enero).
- **📑 Libros de Compras y Ventas ISV (SAR-210):**
  - **Modo Individual:** Calculadora dinámica en tiempo real con desglose al 15%, 18% y ventas/compras exentas. Deducción de saldos anteriores y retenciones recibidas.
  - **Modo Masivo:** Descarga y subida de plantilla Excel/CSV con drag-and-drop para procesar declaraciones de múltiples contribuyentes en segundos.
  - **Impresión Oficial:** Formato de liquidación condensado de 1 sola página listo para auditar o archivar.
- **💬 Cobranza por WhatsApp:** Generación de mensajes y envío directo de recordatorios de cobro a clientes con un solo clic.

---

## 🛠️ Tecnologías Utilizadas

- **Framework:** [Angular](https://angular.dev/) (Standalone Components, Signals & Reactive Forms)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Estilos:** SCSS con diseño moderno Glassmorphism y CSS Grid/Flexbox
- **Iconos:** [Lucide Icons](https://lucide.dev/) (`lucide-angular`)
- **HTTP Client:** Angular `HttpClient` con interceptor JWT

---

## 📋 Requisitos Previos

Asegúrate de tener instalado en tu sistema:
- [Node.js](https://nodejs.org/) (Versión 18 LTS o 20+ recomendada)
- [npm](https://www.npmjs.com/) (incluido con Node.js)
- [ContaFlow API](../ContaFlow.API) corriendo localmente o en servidor

---

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/ContaFlow.git
cd ContaFlow
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar la URL de la API
Verifica o edita la URL base del backend en `src/environments/environment.ts` o en los servicios correspondientes (`src/app/services/`):
```typescript
// Por defecto apunta a:
http://localhost:5057/api
```

### 4. Ejecutar en modo desarrollo
```bash
npm start
# O usando Angular CLI:
npx ng serve --port 4200 --open
```
La aplicación estará disponible en [http://localhost:4200](http://localhost:4200).

---

## 📦 Compilación para Producción

Para generar los archivos listos para desplegar en un servidor web (Nginx, Apache, Vercel, Netlify):

```bash
npm run build
```
Los archivos optimizados se generarán en la carpeta `dist/conta-flow/browser`.

---

## ⌨️ Atajos de Teclado
- `Ctrl + K` (o `Cmd + K` en Mac): Abre el buscador y paleta de comandos rápida para navegar a cualquier pantalla al instante.

---

## 📄 Licencia
Este proyecto es privado para uso de despachos contables. Todos los derechos reservados.
