# CIPSA Catálogos 2025

Estante digital de catálogos PDF con efecto flipbook para CIPSA.

## Estructura

```
g360-catalogos-CIPSA/
├── index.html              # Biblioteca principal
├── catalogo-1.html         # VINIFAN
├── catalogo-2.html         # VINIBALL
├── catalogo-3.html         # INDUSTRIALES
├── catalogo-4.html         # REPRESENTADAS
├── catalogo-5.html         # INSTITUCIONAL
├── catalogs.json           # Metadatos de catálogos
├── css/styles.css          # Estilos G360/CIPSA
├── js/
│   ├── pdfLoader.js        # Renderizado PDF con pdf.js
│   ├── config.js           # Configuración flipbook
│   ├── audio.js            # Sistema de sonidos
│   └── main.js             # Inicialización
├── catalogs/               # Los 5 PDFs
│   ├── catalogo-1.pdf
│   ├── catalogo-2.pdf
│   ├── catalogo-3.pdf
│   ├── catalogo-4.pdf
│   └── catalogo-5.pdf
└── assets/
    └── brand/              # Logos y favicons CIPSA
```

## Características

- **Regleta horizontal**: Navegación entre catálogos con scroll horizontal
- **Flipbook**: Efecto página voladora con StPageFlip
- **Rendimiento**: On-demand rendering (solo páginas visibles)
- **Miniaturas**: Panel emergente para saltar a secciones de 4 páginas
- **Sonidos**: Efectos de audio configurables con toggle mute
- **Responsive**: 1 página en móvil, 2 páginas en desktop
- **URLs compartibles**: Cada catálogo tiene su propia URL directa
- **Fondos personalizados**: Cada catálogo tiene su paleta de colores

## Tecnologías

- **StPageFlip**: Efecto de página voladora
- **pdf.js**: Renderizado de PDFs en canvas
- **Vanilla JS**: Sin framework, máxima compatibilidad

## URLs

| Catálogo | URL |
|----------|-----|
| Biblioteca | `/?` o `index.html` |
| VINIFAN | `/catalogo-1.html` |
| VINIBALL | `/catalogo-2.html` |
| INDUSTRIALES | `/catalogo-3.html` |
| REPRESENTADAS | `/catalogo-4.html` |
| INSTITUCIONAL | `/catalogo-5.html` |

Con página específica: `?page=15`

## Desarrollo Local

```bash
# Usar cualquier servidor HTTP estático
# Ejemplo con Python:
python -m http.server 5174

# O con Node:
npx serve .
```

## Deploy GitHub Pages

1. Crear repositorio en GitHub
2. Push del código
3. Configurar GitHub Pages en settings
4. Branch: main, folder: / (root)

## Actualización Anual

Solo cambiar `"anio"` en `catalogs.json` y reemplazar los PDFs manteniendo nombres iguales.

## Branding

- Logo CIPSA: `assets/brand/logo-cipsa.svg`
- Favicon: `assets/brand/favicon.ico`
- Color G360: `#00d084`
