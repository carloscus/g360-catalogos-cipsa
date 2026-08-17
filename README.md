# g360-catalogos-CIPSA

> Estante digital de catálogos CIPSA con efecto flipbook interactivo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)
[![G360](https://img.shields.io/badge/G360-Ecosystem-00d084)](https://github.com/carloscus/G360-ecosystem)

---

## Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Catálogos](#catálogos)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Uso](#uso)
- [Estructura](#estructura)
- [URLs](#urls)
- [Testing](#testing)
- [Deploy](#deploy)
- [Actualización Anual](#actualización-anual)
- [Contribución](#contribución)
- [Licencia](#licencia)
- [Familia G360](#familia-g360)

---

## Descripción

**g360-catalogos-CIPSA** es un estante digital que presenta los catálogos de productos de CIPSA con un efecto flipbook interactivo. Los usuarios pueden navegar entre catálogos, hojear páginas con animación de volado, y acceder a información detallada de cada línea de productos.

- **Tipo**: Web App estática (HTML/CSS/JS vanilla)
- **Propósito**: Presentación de catálogos de productos CIPSA
- **Deploy**: GitHub Pages

---

## Características

- **Regleta horizontal**: Navegación visual entre catálogos con scroll horizontal
- **Flipbook interactivo**: Efecto de página voladora con StPageFlip
- **Detección automática de orientación**: Se adapta a imágenes portrait o landscape
- **Miniaturas**: Panel emergente para saltar a secciones de páginas
- **Sonidos**: Efectos de audio configurables (flip, hover, jump) con toggle mute
- **Responsive**: Desktop, tablet y móvil con breakpoints en 1024px, 768px y 480px
- **URLs compartibles**: Cada catálogo tiene URL directa con soporte de página específica (`?page=15`)
- **Fondos personalizados**: Cada catálogo tiene su paleta de colores y acentos
- **Identidad G360**: Branding consistente con `g360-signature`

---

## Catálogos

| # | Catálogo | Categoría | Páginas | Descripción |
|---|----------|-----------|---------|-------------|
| 1 | **VINIFAN** | Principal - Escolares | 72 | Vinilos y productos escolares de alto rendimiento |
| 2 | **VINIBALL** | Principal - Pelotas | 76 | Pelotas y sistemas de contención deportiva |
| 3 | **REPRESENTADAS** | Oficina y Tools | 32 | Marcas representadas de oficina y herramientas |
| 4 | **INSTITUCIONAL** | Personalizados | 15 | Productos personalizados e institucionales |
| 5 | **INDUSTRIALES** | Empresas | 10 | Soluciones industriales para empresas |

---

## Tecnologías

- **Core**: HTML5, CSS3, JavaScript (Vanilla)
- **Flipbook**: [StPageFlip](https://github.com/nicholasgasior/page-flip) v2.0.7
- **Estilos**: CSS Custom Properties, Glassmorphism
- **Audio**: Web Audio API (sonidos generados programáticamente)
- **Sin framework**: Máxima compatibilidad, cero dependencias de runtime

---

## Instalación

### Requisitos

- Cualquier servidor HTTP estático
- Python >= 3.x, Node.js >= 18, o equivalente

### Pasos

```bash
# Clonar repositorio
git clone https://github.com/carloscus/g360-catalogos-cipsa.git
cd g360-catalogos-cipsa

# No necesita instalación de dependencias
```

---

## Uso

### Inicio Rápido

```bash
# Con Python
python -m http.server 5174

# Con Node.js
npx serve .

# Abrir en navegador
open http://localhost:5174
```

### Estructura de URLs

| Página | URL |
|--------|-----|
| Biblioteca | `index.html` |
| VINIFAN | `catalogo-1.html` |
| VINIBALL | `catalogo-2.html` |
| REPRESENTADAS | `catalogo-3.html` |
| INSTITUCIONAL | `catalogo-4.html` |
| INDUSTRIALES | `catalogo-5.html` |
| Página específica | `catalogo-1.html?page=15` |

---

## Estructura

```
g360-catalogos-CIPSA/
├── index.html                  # Biblioteca principal
├── catalogo-1.html             # VINIFAN
├── catalogo-2.html             # VINIBALL
├── catalogo-3.html             # REPRESENTADAS
├── catalogo-4.html             # INSTITUCIONAL
├── catalogo-5.html             # INDUSTRIALES
├── css/
│   └── styles.css              # Estilos globales G360/CIPSA
├── js/
│   ├── config.js               # Configuración de catálogos y flipbook
│   └── audio.js                # Sistema de sonidos Web Audio
├── images/
│   ├── vinifan/                # Páginas del catálogo VINIFAN
│   │   ├── cover.jpg
│   │   └── page_001.jpg ... page_072.jpg
│   ├── viniball/               # Páginas del catálogo VINIBALL
│   ├── representadas/          # Páginas del catálogo REPRESENTADAS
│   ├── institucional/          # Páginas del catálogo INSTITUCIONAL
│   └── industriales/           # Páginas del catálogo INDUSTRIALES
├── assets/
│   └── brand/                  # Logos y favicons CIPSA
│       ├── logo-cipsa.svg
│       └── favicon.svg
└── test_all_catalogs.py        # Script de testing
```

---

## Testing

```bash
# Ejecutar test de todos los catálogos
python test_all_catalogs.py
```

---

## Deploy

### GitHub Pages

1. Crear repositorio en GitHub
2. Push del código a `main`
3. Settings > Pages > Source: Deploy from branch
4. Branch: `main`, folder: `/ (root)`
5. Acceder a `https://carloscus.github.io/g360-catalogos-cipsa/`

---

## Actualización Anual

1. Reemplazar las imágenes en `images/{tema}/page_*.jpg` manteniendo los nombres
2. Actualizar `total_pages` en `js/config.js` si cambia la cantidad de páginas
3. Actualizar las portadas en `images/{tema}/cover.jpg`
4. Commit y push

---

## Contribución

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcion`)
3. Commit cambios (`git commit -m 'Agregar función'`)
4. Push a la rama (`git push origin feature/nueva-funcion`)
5. Abre un Pull Request

---

## Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.

---

## Familia G360

Este proyecto forma parte de la familia de microherramientas **G360** para apoyo CRM y gestión de datos en escritorio, enfocadas en áreas como ventas, finanzas y logística.

### Herramientas Relacionadas

- [g360-cli](https://github.com/carloscus/g360-cli) - CLI para automatización de tareas
- [g360-order-xlsx](https://github.com/carloscus/g360-order-xlsx) - Gestión de pedidos
- [g360-signature](https://github.com/carloscus/g360-signature) - Generador de firmas
- [g360-discount-calculator](https://github.com/carloscus/g360-discount-calculator) - Calculadora de descuentos

---

**Marca**: G360
**Isotipo**: 3 puntos verticales paralelos (gris-verde-gris) + chevron `>`
**Autor**: Carlos Cusi
**Desarrollo**: Con asistencia de herramientas de código IA (Vibe Code)
**Powered by**: [g360-signature](https://github.com/carloscus/g360-signature)
