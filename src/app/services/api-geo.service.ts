import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
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

export const HONDURAS_CATALOGO_DEFAULT: DepartamentoResponse[] = [
  {
    id: 1, codigo: '01', nombre: 'Atlántida', cabecera: 'La Ceiba',
    municipios: [
      { id: 101, departamentoId: 1, codigo: '0101', nombre: 'La Ceiba' },
      { id: 102, departamentoId: 1, codigo: '0102', nombre: 'El Porvenir' },
      { id: 103, departamentoId: 1, codigo: '0103', nombre: 'Esparta' },
      { id: 104, departamentoId: 1, codigo: '0104', nombre: 'Jutiapa' },
      { id: 105, departamentoId: 1, codigo: '0105', nombre: 'La Masica' },
      { id: 106, departamentoId: 1, codigo: '0106', nombre: 'San Francisco' },
      { id: 107, departamentoId: 1, codigo: '0107', nombre: 'Tela' },
      { id: 108, departamentoId: 1, codigo: '0108', nombre: 'Arizona' }
    ]
  },
  {
    id: 2, codigo: '02', nombre: 'Colón', cabecera: 'Trujillo',
    municipios: [
      { id: 201, departamentoId: 2, codigo: '0201', nombre: 'Trujillo' },
      { id: 202, departamentoId: 2, codigo: '0202', nombre: 'Balfate' },
      { id: 203, departamentoId: 2, codigo: '0203', nombre: 'Iriona' },
      { id: 204, departamentoId: 2, codigo: '0204', nombre: 'Limón' },
      { id: 205, departamentoId: 2, codigo: '0205', nombre: 'Sabá' },
      { id: 206, departamentoId: 2, codigo: '0206', nombre: 'Santa Fe' },
      { id: 207, departamentoId: 2, codigo: '0207', nombre: 'Santa Rosa de Aguán' },
      { id: 208, departamentoId: 2, codigo: '0208', nombre: 'Sonaguera' },
      { id: 209, departamentoId: 2, codigo: '0209', nombre: 'Tocoa' },
      { id: 210, departamentoId: 2, codigo: '0210', nombre: 'Bonito Oriental' }
    ]
  },
  {
    id: 3, codigo: '03', nombre: 'Comayagua', cabecera: 'Comayagua',
    municipios: [
      { id: 301, departamentoId: 3, codigo: '0301', nombre: 'Comayagua' },
      { id: 302, departamentoId: 3, codigo: '0302', nombre: 'Ajuterique' },
      { id: 303, departamentoId: 3, codigo: '0303', nombre: 'El Rosario' },
      { id: 304, departamentoId: 3, codigo: '0304', nombre: 'Esquías' },
      { id: 305, departamentoId: 3, codigo: '0305', nombre: 'Humuya' },
      { id: 306, departamentoId: 3, codigo: '0306', nombre: 'La Libertad' },
      { id: 307, departamentoId: 3, codigo: '0307', nombre: 'Lamaní' },
      { id: 308, departamentoId: 3, codigo: '0308', nombre: 'La Trinidad' },
      { id: 309, departamentoId: 3, codigo: '0309', nombre: 'Lejamaní' },
      { id: 310, departamentoId: 3, codigo: '0310', nombre: 'Meámbar' },
      { id: 311, departamentoId: 3, codigo: '0311', nombre: 'Minas de Oro' },
      { id: 312, departamentoId: 3, codigo: '0312', nombre: 'Ojos de Agua' },
      { id: 313, departamentoId: 3, codigo: '0313', nombre: 'San Jerónimo' },
      { id: 314, departamentoId: 3, codigo: '0314', nombre: 'San José de Comayagua' },
      { id: 315, departamentoId: 3, codigo: '0315', nombre: 'San José del Potrero' },
      { id: 316, departamentoId: 3, codigo: '0316', nombre: 'San Luis' },
      { id: 317, departamentoId: 3, codigo: '0317', nombre: 'San Sebastián' },
      { id: 318, departamentoId: 3, codigo: '0318', nombre: 'Siguatepeque' },
      { id: 319, departamentoId: 3, codigo: '0319', nombre: 'Villa de San Antonio' },
      { id: 320, departamentoId: 3, codigo: '0320', nombre: 'Las Lajas' },
      { id: 321, departamentoId: 3, codigo: '0321', nombre: 'Taulabé' }
    ]
  },
  {
    id: 4, codigo: '04', nombre: 'Copán', cabecera: 'Santa Rosa de Copán',
    municipios: [
      { id: 401, departamentoId: 4, codigo: '0401', nombre: 'Santa Rosa de Copán' },
      { id: 402, departamentoId: 4, codigo: '0402', nombre: 'Cabañas' },
      { id: 403, departamentoId: 4, codigo: '0403', nombre: 'Concepción' },
      { id: 404, departamentoId: 4, codigo: '0404', nombre: 'Copán Ruinas' },
      { id: 405, departamentoId: 4, codigo: '0405', nombre: 'Corquín' },
      { id: 406, departamentoId: 4, codigo: '0406', nombre: 'Cucuyagua' },
      { id: 407, departamentoId: 4, codigo: '0407', nombre: 'Dolores' },
      { id: 408, departamentoId: 4, codigo: '0408', nombre: 'Dulce Nombre' },
      { id: 409, departamentoId: 4, codigo: '0409', nombre: 'El Paraíso' },
      { id: 410, departamentoId: 4, codigo: '0410', nombre: 'Florida' },
      { id: 411, departamentoId: 4, codigo: '0411', nombre: 'La Jigua' },
      { id: 412, departamentoId: 4, codigo: '0412', nombre: 'La Unión' },
      { id: 413, departamentoId: 4, codigo: '0413', nombre: 'Nueva Arcadia (La Entrada)' },
      { id: 414, departamentoId: 4, codigo: '0414', nombre: 'San Agustín' },
      { id: 415, departamentoId: 4, codigo: '0415', nombre: 'San Antonio' },
      { id: 416, departamentoId: 4, codigo: '0416', nombre: 'San Jerónimo' },
      { id: 417, departamentoId: 4, codigo: '0417', nombre: 'San José' },
      { id: 418, departamentoId: 4, codigo: '0418', nombre: 'San Juan de Opoa' },
      { id: 419, departamentoId: 4, codigo: '0419', nombre: 'San Nicolás' },
      { id: 420, departamentoId: 4, codigo: '0420', nombre: 'San Pedro' },
      { id: 421, departamentoId: 4, codigo: '0421', nombre: 'Santa Rita' },
      { id: 422, departamentoId: 4, codigo: '0422', nombre: 'Trinidad de Copán' },
      { id: 423, departamentoId: 4, codigo: '0423', nombre: 'Veracruz' }
    ]
  },
  {
    id: 5, codigo: '05', nombre: 'Cortés', cabecera: 'San Pedro Sula',
    municipios: [
      { id: 501, departamentoId: 5, codigo: '0501', nombre: 'San Pedro Sula' },
      { id: 502, departamentoId: 5, codigo: '0502', nombre: 'Choloma' },
      { id: 503, departamentoId: 5, codigo: '0503', nombre: 'Omoa' },
      { id: 504, departamentoId: 5, codigo: '0504', nombre: 'Pimienta' },
      { id: 505, departamentoId: 5, codigo: '0505', nombre: 'Potrerillos' },
      { id: 506, departamentoId: 5, codigo: '0506', nombre: 'Puerto Cortés' },
      { id: 507, departamentoId: 5, codigo: '0507', nombre: 'San Antonio de Cortés' },
      { id: 508, departamentoId: 5, codigo: '0508', nombre: 'San Francisco de Yojoa' },
      { id: 509, departamentoId: 5, codigo: '0509', nombre: 'San Manuel' },
      { id: 510, departamentoId: 5, codigo: '0510', nombre: 'Santa Cruz de Yojoa' },
      { id: 511, departamentoId: 5, codigo: '0511', nombre: 'Villanueva' },
      { id: 512, departamentoId: 5, codigo: '0512', nombre: 'La Lima' }
    ]
  },
  {
    id: 6, codigo: '06', nombre: 'Choluteca', cabecera: 'Choluteca',
    municipios: [
      { id: 601, departamentoId: 6, codigo: '0601', nombre: 'Choluteca' },
      { id: 602, departamentoId: 6, codigo: '0602', nombre: 'Apacilagua' },
      { id: 603, departamentoId: 6, codigo: '0603', nombre: 'Concepción de María' },
      { id: 604, departamentoId: 6, codigo: '0604', nombre: 'Duyure' },
      { id: 605, departamentoId: 6, codigo: '0605', nombre: 'El Corpus' },
      { id: 606, departamentoId: 6, codigo: '0606', nombre: 'El Triunfo' },
      { id: 607, departamentoId: 6, codigo: '0607', nombre: 'Marcovia' },
      { id: 608, departamentoId: 6, codigo: '0608', nombre: 'Morolica' },
      { id: 609, departamentoId: 6, codigo: '0609', nombre: 'Namasigüe' },
      { id: 610, departamentoId: 6, codigo: '0610', nombre: 'Orocuina' },
      { id: 611, departamentoId: 6, codigo: '0611', nombre: 'Pespire' },
      { id: 612, departamentoId: 6, codigo: '0612', nombre: 'San Antonio de Flores' },
      { id: 613, departamentoId: 6, codigo: '0613', nombre: 'San Isidro' },
      { id: 614, departamentoId: 6, codigo: '0614', nombre: 'San José' },
      { id: 615, departamentoId: 6, codigo: '0615', nombre: 'San Marcos de Colón' },
      { id: 616, departamentoId: 6, codigo: '0616', nombre: 'Santa Ana de Yusguare' }
    ]
  },
  {
    id: 7, codigo: '07', nombre: 'El Paraíso', cabecera: 'Yuscarán',
    municipios: [
      { id: 701, departamentoId: 7, codigo: '0701', nombre: 'Yuscarán' },
      { id: 702, departamentoId: 7, codigo: '0702', nombre: 'Alauca' },
      { id: 703, departamentoId: 7, codigo: '0703', nombre: 'Danlí' },
      { id: 704, departamentoId: 7, codigo: '0704', nombre: 'El Paraíso' },
      { id: 705, departamentoId: 7, codigo: '0705', nombre: 'Güinope' },
      { id: 706, departamentoId: 7, codigo: '0706', nombre: 'Jacaleapa' },
      { id: 707, departamentoId: 7, codigo: '0707', nombre: 'Liure' },
      { id: 708, departamentoId: 7, codigo: '0708', nombre: 'Morocelí' },
      { id: 709, departamentoId: 7, codigo: '0709', nombre: 'Oropolí' },
      { id: 710, departamentoId: 7, codigo: '0710', nombre: 'Potrerillos' },
      { id: 711, departamentoId: 7, codigo: '0711', nombre: 'San Antonio de Flores' },
      { id: 712, departamentoId: 7, codigo: '0712', nombre: 'San Lucas' },
      { id: 713, departamentoId: 7, codigo: '0713', nombre: 'San Matías' },
      { id: 714, departamentoId: 7, codigo: '0714', nombre: 'Soledad' },
      { id: 715, departamentoId: 7, codigo: '0715', nombre: 'Teupasenti' },
      { id: 716, departamentoId: 7, codigo: '0716', nombre: 'Texiguat' },
      { id: 717, departamentoId: 7, codigo: '0717', nombre: 'Vado Ancho' },
      { id: 718, departamentoId: 7, codigo: '0718', nombre: 'Yauyupe' },
      { id: 719, departamentoId: 7, codigo: '0719', nombre: 'Trojes' }
    ]
  },
  {
    id: 8, codigo: '08', nombre: 'Francisco Morazán', cabecera: 'Distrito Central',
    municipios: [
      { id: 801, departamentoId: 8, codigo: '0801', nombre: 'Distrito Central (Tegucigalpa / M.D.C.)' },
      { id: 802, departamentoId: 8, codigo: '0802', nombre: 'Alubarén' },
      { id: 803, departamentoId: 8, codigo: '0803', nombre: 'Cedros' },
      { id: 804, departamentoId: 8, codigo: '0804', nombre: 'Curarén' },
      { id: 805, departamentoId: 8, codigo: '0805', nombre: 'El Porvenir' },
      { id: 806, departamentoId: 8, codigo: '0806', nombre: 'Guaimaca' },
      { id: 807, departamentoId: 8, codigo: '0807', nombre: 'La Libertad' },
      { id: 808, departamentoId: 8, codigo: '0808', nombre: 'La Venta' },
      { id: 809, departamentoId: 8, codigo: '0809', nombre: 'Lepaterique' },
      { id: 810, departamentoId: 8, codigo: '0810', nombre: 'Maraita' },
      { id: 811, departamentoId: 8, codigo: '0811', nombre: 'Marale' },
      { id: 812, departamentoId: 8, codigo: '0812', nombre: 'Nueva Armenia' },
      { id: 813, departamentoId: 8, codigo: '0813', nombre: 'Ojojona' },
      { id: 814, departamentoId: 8, codigo: '0814', nombre: 'Orica' },
      { id: 815, departamentoId: 8, codigo: '0815', nombre: 'Reitoca' },
      { id: 816, departamentoId: 8, codigo: '0816', nombre: 'Sabanagrande' },
      { id: 817, departamentoId: 8, codigo: '0817', nombre: 'San Antonio de Oriente' },
      { id: 818, departamentoId: 8, codigo: '0818', nombre: 'San Buenaventura' },
      { id: 819, departamentoId: 8, codigo: '0819', nombre: 'San Ignacio' },
      { id: 820, departamentoId: 8, codigo: '0820', nombre: 'San Juan de Flores (Cantarranas)' },
      { id: 821, departamentoId: 8, codigo: '0821', nombre: 'San Miguelito' },
      { id: 822, departamentoId: 8, codigo: '0822', nombre: 'Santa Ana' },
      { id: 823, departamentoId: 8, codigo: '0823', nombre: 'Santa Lucía' },
      { id: 824, departamentoId: 8, codigo: '0824', nombre: 'Talanga' },
      { id: 825, departamentoId: 8, codigo: '0825', nombre: 'Tatumbla' },
      { id: 826, departamentoId: 8, codigo: '0826', nombre: 'Valle de Ángeles' },
      { id: 827, departamentoId: 8, codigo: '0827', nombre: 'Villa de San Francisco' },
      { id: 828, departamentoId: 8, codigo: '0828', nombre: 'Vallecillo' }
    ]
  },
  {
    id: 9, codigo: '09', nombre: 'Gracias a Dios', cabecera: 'Puerto Lempira',
    municipios: [
      { id: 901, departamentoId: 9, codigo: '0901', nombre: 'Puerto Lempira' },
      { id: 902, departamentoId: 9, codigo: '0902', nombre: 'Brus Laguna' },
      { id: 903, departamentoId: 9, codigo: '0903', nombre: 'Ahuas' },
      { id: 904, departamentoId: 9, codigo: '0904', nombre: 'Juan Francisco Bulnes' },
      { id: 905, departamentoId: 9, codigo: '0905', nombre: 'Ramón Villeda Morales' },
      { id: 906, departamentoId: 9, codigo: '0906', nombre: 'Wampusirpi' }
    ]
  },
  {
    id: 10, codigo: '10', nombre: 'Intibucá', cabecera: 'La Esperanza',
    municipios: [
      { id: 1001, departamentoId: 10, codigo: '1001', nombre: 'La Esperanza' },
      { id: 1002, departamentoId: 10, codigo: '1002', nombre: 'Camasca' },
      { id: 1003, departamentoId: 10, codigo: '1003', nombre: 'Colomoncagua' },
      { id: 1004, departamentoId: 10, codigo: '1004', nombre: 'Concepción' },
      { id: 1005, departamentoId: 10, codigo: '1005', nombre: 'Dolores' },
      { id: 1006, departamentoId: 10, codigo: '1006', nombre: 'Intibucá' },
      { id: 1007, departamentoId: 10, codigo: '1007', nombre: 'Jesús de Otoro' },
      { id: 1008, departamentoId: 10, codigo: '1008', nombre: 'Magdalena' },
      { id: 1009, departamentoId: 10, codigo: '1009', nombre: 'Masaguara' },
      { id: 1010, departamentoId: 10, codigo: '1010', nombre: 'San Antonio' },
      { id: 1011, departamentoId: 10, codigo: '1011', nombre: 'San Isidro' },
      { id: 1012, departamentoId: 10, codigo: '1012', nombre: 'San Juan' },
      { id: 1013, departamentoId: 10, codigo: '1013', nombre: 'San Marcos de la Sierra' },
      { id: 1014, departamentoId: 10, codigo: '1014', nombre: 'San Miguel Guancapla' },
      { id: 1015, departamentoId: 10, codigo: '1015', nombre: 'Santa Lucía' },
      { id: 1016, departamentoId: 10, codigo: '1016', nombre: 'Yamaranguila' },
      { id: 1017, departamentoId: 10, codigo: '1017', nombre: 'San Francisco de Opalaca' }
    ]
  },
  {
    id: 11, codigo: '11', nombre: 'Islas de la Bahía', cabecera: 'Roatán',
    municipios: [
      { id: 1101, departamentoId: 11, codigo: '1101', nombre: 'Roatán' },
      { id: 1102, departamentoId: 11, codigo: '1102', nombre: 'Guanaja' },
      { id: 1103, departamentoId: 11, codigo: '1103', nombre: 'José Santos Guardiola' },
      { id: 1104, departamentoId: 11, codigo: '1104', nombre: 'Utila' }
    ]
  },
  {
    id: 12, codigo: '12', nombre: 'La Paz', cabecera: 'La Paz',
    municipios: [
      { id: 1201, departamentoId: 12, codigo: '1201', nombre: 'La Paz' },
      { id: 1202, departamentoId: 12, codigo: '1202', nombre: 'Aguanqueterique' },
      { id: 1203, departamentoId: 12, codigo: '1203', nombre: 'Cabañas' },
      { id: 1204, departamentoId: 12, codigo: '1204', nombre: 'Cane' },
      { id: 1205, departamentoId: 12, codigo: '1205', nombre: 'Chinacla' },
      { id: 1206, departamentoId: 12, codigo: '1206', nombre: 'Guajiquiro' },
      { id: 1207, departamentoId: 12, codigo: '1207', nombre: 'Lauterique' },
      { id: 1208, departamentoId: 12, codigo: '1208', nombre: 'Marcala' },
      { id: 1209, departamentoId: 12, codigo: '1209', nombre: 'Mercedes de Oriente' },
      { id: 1210, departamentoId: 12, codigo: '1210', nombre: 'Opatoro' },
      { id: 1211, departamentoId: 12, codigo: '1211', nombre: 'San Antonio del Norte' },
      { id: 1212, departamentoId: 12, codigo: '1212', nombre: 'San José' },
      { id: 1213, departamentoId: 12, codigo: '1213', nombre: 'San Juan' },
      { id: 1214, departamentoId: 12, codigo: '1214', nombre: 'San Pedro de Tutule' },
      { id: 1215, departamentoId: 12, codigo: '1215', nombre: 'Santa Ana' },
      { id: 1216, departamentoId: 12, codigo: '1216', nombre: 'Santa Elena' },
      { id: 1217, departamentoId: 12, codigo: '1217', nombre: 'Santa María' },
      { id: 1218, departamentoId: 12, codigo: '1218', nombre: 'Santiago de Puringla' },
      { id: 1219, departamentoId: 12, codigo: '1219', nombre: 'Yarula' }
    ]
  },
  {
    id: 13, codigo: '13', nombre: 'Lempira', cabecera: 'Gracias',
    municipios: [
      { id: 1301, departamentoId: 13, codigo: '1301', nombre: 'Gracias' },
      { id: 1302, departamentoId: 13, codigo: '1302', nombre: 'Belén' },
      { id: 1303, departamentoId: 13, codigo: '1303', nombre: 'Candelaria' },
      { id: 1304, departamentoId: 13, codigo: '1304', nombre: 'Cololaca' },
      { id: 1305, departamentoId: 13, codigo: '1305', nombre: 'Erandique' },
      { id: 1306, departamentoId: 13, codigo: '1306', nombre: 'Gualcince' },
      { id: 1307, departamentoId: 13, codigo: '1307', nombre: 'Guarita' },
      { id: 1308, departamentoId: 13, codigo: '1308', nombre: 'La Campa' },
      { id: 1309, departamentoId: 13, codigo: '1309', nombre: 'La Iguala' },
      { id: 1310, departamentoId: 13, codigo: '1310', nombre: 'Las Flores' },
      { id: 1311, departamentoId: 13, codigo: '1311', nombre: 'La Unión' },
      { id: 1312, departamentoId: 13, codigo: '1312', nombre: 'Mapulaca' },
      { id: 1313, departamentoId: 13, codigo: '1313', nombre: 'Piraera' },
      { id: 1314, departamentoId: 13, codigo: '1314', nombre: 'San Andrés' },
      { id: 1315, departamentoId: 13, codigo: '1315', nombre: 'San Francisco' },
      { id: 1316, departamentoId: 13, codigo: '1316', nombre: 'San Juan Guarita' },
      { id: 1317, departamentoId: 13, codigo: '1317', nombre: 'San Manuel Colohete' },
      { id: 1318, departamentoId: 13, codigo: '1318', nombre: 'San Rafael' },
      { id: 1319, departamentoId: 13, codigo: '1319', nombre: 'San Sebastián' },
      { id: 1320, departamentoId: 13, codigo: '1320', nombre: 'Santa Cruz' },
      { id: 1321, departamentoId: 13, codigo: '1321', nombre: 'Talgua' },
      { id: 1322, departamentoId: 13, codigo: '1322', nombre: 'Tambla' },
      { id: 1323, departamentoId: 13, codigo: '1323', nombre: 'Tomalá' },
      { id: 1324, departamentoId: 13, codigo: '1324', nombre: 'Valladolid' },
      { id: 1325, departamentoId: 13, codigo: '1325', nombre: 'Virginia' },
      { id: 1326, departamentoId: 13, codigo: '1326', nombre: 'San Marcos de Caiquín' },
      { id: 1327, departamentoId: 13, codigo: '1327', nombre: 'La Virtud' },
      { id: 1328, departamentoId: 13, codigo: '1328', nombre: 'Lepaera' }
    ]
  },
  {
    id: 14, codigo: '14', nombre: 'Ocotepeque', cabecera: 'Ocotepeque',
    municipios: [
      { id: 1401, departamentoId: 14, codigo: '1401', nombre: 'Ocotepeque' },
      { id: 1402, departamentoId: 14, codigo: '1402', nombre: 'Belén Gualcho' },
      { id: 1403, departamentoId: 14, codigo: '1403', nombre: 'Concepción' },
      { id: 1404, departamentoId: 14, codigo: '1404', nombre: 'Dolores Merendón' },
      { id: 1405, departamentoId: 14, codigo: '1405', nombre: 'Fraternidad' },
      { id: 1406, departamentoId: 14, codigo: '1406', nombre: 'La Encarnación' },
      { id: 1407, departamentoId: 14, codigo: '1407', nombre: 'La Labor' },
      { id: 1408, departamentoId: 14, codigo: '1408', nombre: 'Lucerna' },
      { id: 1409, departamentoId: 14, codigo: '1409', nombre: 'Mercedes' },
      { id: 1410, departamentoId: 14, codigo: '1410', nombre: 'San Fernando' },
      { id: 1411, departamentoId: 14, codigo: '1411', nombre: 'San Francisco del Valle' },
      { id: 1412, departamentoId: 14, codigo: '1412', nombre: 'San Jorge' },
      { id: 1413, departamentoId: 14, codigo: '1413', nombre: 'San Marcos' },
      { id: 1414, departamentoId: 14, codigo: '1414', nombre: 'Santa Fe' },
      { id: 1415, departamentoId: 14, codigo: '1415', nombre: 'Sensenti' },
      { id: 1416, departamentoId: 14, codigo: '1416', nombre: 'Sinuapa' }
    ]
  },
  {
    id: 15, codigo: '15', nombre: 'Olancho', cabecera: 'Juticalpa',
    municipios: [
      { id: 1501, departamentoId: 15, codigo: '1501', nombre: 'Juticalpa' },
      { id: 1502, departamentoId: 15, codigo: '1502', nombre: 'Campamento' },
      { id: 1503, departamentoId: 15, codigo: '1503', nombre: 'Catacamas' },
      { id: 1504, departamentoId: 15, codigo: '1504', nombre: 'Concordia' },
      { id: 1505, departamentoId: 15, codigo: '1505', nombre: 'Dulce Nombre de Culmí' },
      { id: 1506, departamentoId: 15, codigo: '1506', nombre: 'El Rosario' },
      { id: 1507, departamentoId: 15, codigo: '1507', nombre: 'Esquipulas del Norte' },
      { id: 1508, departamentoId: 15, codigo: '1508', nombre: 'Gualaco' },
      { id: 1509, departamentoId: 15, codigo: '1509', nombre: 'Guarizama' },
      { id: 1510, departamentoId: 15, codigo: '1510', nombre: 'Guata' },
      { id: 1511, departamentoId: 15, codigo: '1511', nombre: 'Guayape' },
      { id: 1512, departamentoId: 15, codigo: '1512', nombre: 'Jano' },
      { id: 1513, departamentoId: 15, codigo: '1513', nombre: 'La Unión' },
      { id: 1514, departamentoId: 15, codigo: '1514', nombre: 'Mangulile' },
      { id: 1515, departamentoId: 15, codigo: '1515', nombre: 'Manto' },
      { id: 1516, departamentoId: 15, codigo: '1516', nombre: 'Salamá' },
      { id: 1517, departamentoId: 15, codigo: '1517', nombre: 'San Esteban' },
      { id: 1518, departamentoId: 15, codigo: '1518', nombre: 'San Francisco de Becerra' },
      { id: 1519, departamentoId: 15, codigo: '1519', nombre: 'San Francisco de la Paz' },
      { id: 1520, departamentoId: 15, codigo: '1520', nombre: 'Santa María del Real' },
      { id: 1521, departamentoId: 15, codigo: '1521', nombre: 'Silca' },
      { id: 1522, departamentoId: 15, codigo: '1522', nombre: 'Yocón' },
      { id: 1523, departamentoId: 15, codigo: '1523', nombre: 'Patuca' }
    ]
  },
  {
    id: 16, codigo: '16', nombre: 'Santa Bárbara', cabecera: 'Santa Bárbara',
    municipios: [
      { id: 1601, departamentoId: 16, codigo: '1601', nombre: 'Santa Bárbara' },
      { id: 1602, departamentoId: 16, codigo: '1602', nombre: 'Arada' },
      { id: 1603, departamentoId: 16, codigo: '1603', nombre: 'Atima' },
      { id: 1604, departamentoId: 16, codigo: '1604', nombre: 'Azacualpa' },
      { id: 1605, departamentoId: 16, codigo: '1605', nombre: 'Ceguaca' },
      { id: 1606, departamentoId: 16, codigo: '1606', nombre: 'San José de las Colinas' },
      { id: 1607, departamentoId: 16, codigo: '1607', nombre: 'Concepción del Norte' },
      { id: 1608, departamentoId: 16, codigo: '1608', nombre: 'Concepción del Sur' },
      { id: 1609, departamentoId: 16, codigo: '1609', nombre: 'Chinda' },
      { id: 1610, departamentoId: 16, codigo: '1610', nombre: 'El Níspero' },
      { id: 1611, departamentoId: 16, codigo: '1611', nombre: 'Gualala' },
      { id: 1612, departamentoId: 16, codigo: '1612', nombre: 'Ilama' },
      { id: 1613, departamentoId: 16, codigo: '1613', nombre: 'Macuelizo' },
      { id: 1614, departamentoId: 16, codigo: '1614', nombre: 'Naranjito' },
      { id: 1615, departamentoId: 16, codigo: '1615', nombre: 'Nuevo Celilac' },
      { id: 1616, departamentoId: 16, codigo: '1616', nombre: 'Petoa' },
      { id: 1617, departamentoId: 16, codigo: '1617', nombre: 'Protección' },
      { id: 1618, departamentoId: 16, codigo: '1618', nombre: 'Quimistán' },
      { id: 1619, departamentoId: 16, codigo: '1619', nombre: 'San Francisco de Ojuera' },
      { id: 1620, departamentoId: 16, codigo: '1620', nombre: 'San Luis' },
      { id: 1621, departamentoId: 16, codigo: '1621', nombre: 'San Marcos' },
      { id: 1622, departamentoId: 16, codigo: '1622', nombre: 'San Nicolás' },
      { id: 1623, departamentoId: 16, codigo: '1623', nombre: 'San Pedro Zacapa' },
      { id: 1624, departamentoId: 16, codigo: '1624', nombre: 'Santa Rita' },
      { id: 1625, departamentoId: 16, codigo: '1625', nombre: 'Trinidad' },
      { id: 1626, departamentoId: 16, codigo: '1626', nombre: 'Las Vegas' },
      { id: 1627, departamentoId: 16, codigo: '1627', nombre: 'Nueva Frontera' }
    ]
  },
  {
    id: 17, codigo: '17', nombre: 'Valle', cabecera: 'Nacaome',
    municipios: [
      { id: 1701, departamentoId: 17, codigo: '1701', nombre: 'Nacaome' },
      { id: 1702, departamentoId: 17, codigo: '1702', nombre: 'Alianza' },
      { id: 1703, departamentoId: 17, codigo: '1703', nombre: 'Amapala' },
      { id: 1704, departamentoId: 17, codigo: '1704', nombre: 'Aramecina' },
      { id: 1705, departamentoId: 17, codigo: '1705', nombre: 'Caridad' },
      { id: 1706, departamentoId: 17, codigo: '1706', nombre: 'Goascorán' },
      { id: 1707, departamentoId: 17, codigo: '1707', nombre: 'Langue' },
      { id: 1708, departamentoId: 17, codigo: '1708', nombre: 'San Francisco de Coray' },
      { id: 1709, departamentoId: 17, codigo: '1709', nombre: 'San Lorenzo' }
    ]
  },
  {
    id: 18, codigo: '18', nombre: 'Yoro', cabecera: 'Yoro',
    municipios: [
      { id: 1801, departamentoId: 18, codigo: '1801', nombre: 'Yoro' },
      { id: 1802, departamentoId: 18, codigo: '1802', nombre: 'Arenal' },
      { id: 1803, departamentoId: 18, codigo: '1803', nombre: 'El Negrito' },
      { id: 1804, departamentoId: 18, codigo: '1804', nombre: 'El Progreso' },
      { id: 1805, departamentoId: 18, codigo: '1805', nombre: 'Jocón' },
      { id: 1806, departamentoId: 18, codigo: '1806', nombre: 'Morazán' },
      { id: 1807, departamentoId: 18, codigo: '1807', nombre: 'Olanchito' },
      { id: 1808, departamentoId: 18, codigo: '1808', nombre: 'Santa Rita' },
      { id: 1809, departamentoId: 18, codigo: '1809', nombre: 'Sulaco' },
      { id: 1810, departamentoId: 18, codigo: '1810', nombre: 'Victoria' },
      { id: 1811, departamentoId: 18, codigo: '1811', nombre: 'Yorito' }
    ]
  }
];

@Injectable({
  providedIn: 'root'
})
export class ApiGeoService {
  private readonly http = inject(HttpClient);

  // Inicializado con el catálogo oficial completo de Honduras para disponibilidad inmediata
  readonly departamentos = signal<DepartamentoResponse[]>(HONDURAS_CATALOGO_DEFAULT);
  readonly isLoaded = signal<boolean>(true);

  cargarDepartamentos(): Observable<DepartamentoResponse[]> {
    return this.http.get<DepartamentoResponse[]>(`${environment.apiUrl}/api/geo/departamentos`).pipe(
      tap((data) => {
        if (data && data.length > 0) {
          this.departamentos.set(data);
        }
      }),
      catchError(() => {
        // En caso de fallo o timeout de red, mantiene el catálogo oficial offline
        return of(this.departamentos());
      })
    );
  }

  /**
   * Intenta resolver Departamento y Municipio a partir del código de 4 dígitos inicial
   * del RTN o DNI hondureño (ej. '0801' -> Francisco Morazán / Distrito Central; '0601' -> Choluteca).
   */
  detectarUbicacionPorRtnODni(codigoRtnODni: string): {
    departamentoId?: number;
    departamentoNombre?: string;
    municipioId?: number;
    municipioNombre?: string;
  } | null {
    if (!codigoRtnODni) return null;
    let cleanCode = codigoRtnODni.replace(/[^0-9]/g, '').trim();
    if (cleanCode.length < 3) return null;

    // Si tiene 13 dígitos y le falta el 0 inicial (ej: 6011953000309 en vez de 0601...)
    if (cleanCode.length === 13 && cleanCode[0] !== '0') {
      cleanCode = '0' + cleanCode;
    }

    if (cleanCode.length < 4) return null;

    const codMun = cleanCode.substring(0, 4); // ej: "0601"
    const codDep = cleanCode.substring(0, 2); // ej: "06"

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
