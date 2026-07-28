# Google Search Console — Guía de configuración

## 1. Acceder a Search Console

Ir a: https://search.google.com/search-console

Iniciar sesión con la cuenta Google asociada al dominio (la misma que tiene acceso a GTM y GA4 idealmente).

---

## 2. Agregar la propiedad del sitio

Si `longevityargentina.com` aún no aparece como propiedad:

1. Clic en **"Agregar propiedad"**
2. Elegir **"Dominio"** (no "Prefijo de URL") — cubre tanto `www` como `no-www` y `http`/`https`
3. Ingresar: `longevityargentina.com`
4. Verificar la propiedad (ver sección siguiente)

---

## 3. Verificar la propiedad via Google Tag Manager

Es el método más rápido porque GTM ya está instalado en el sitio (container `GTM-M7T2WPBX`).

1. En el paso de verificación, Search Console detecta automáticamente que GTM está presente
2. Seleccionar la opción **"Google Tag Manager"**
3. Confirmar que el container ID que muestra coincide con `GTM-M7T2WPBX`
4. Clic en **"Verificar"**

> Si no aparece GTM como opción, usar el método alternativo: **"Etiqueta HTML"** — pega el snippet que te dan en el `<head>` de `index.html` y luego hace clic en Verificar.

---

## 4. Enviar el sitemap

Una vez verificada la propiedad:

1. En el menú izquierdo ir a **Sitemaps**
2. En el campo **"Agregar un nuevo sitemap"** escribir:
   ```
   sitemap.xml
   ```
3. Clic en **"Enviar"**

Search Console debería mostrar:
- **Estado:** Correcto
- **URLs detectadas:** 7

El sitemap cubre estas páginas:

| Página | Prioridad |
|---|---|
| / (inicio) | 1.0 |
| /servicio-cuidadores.html | 0.8 |
| /servicio-acompanantes-terapeuticos.html | 0.8 |
| /servicio-enfermeria.html | 0.8 |
| /servicio-elder-full-caregiving.html | 0.8 |
| /faq.html | 0.7 |
| /antecedentes.html | 0.5 |

Nota: las 7 páginas de servicio viejas (servicio-cuidador.html, servicio-acompanante-terapeutico.html, servicio-auxiliar-enfermeria.html, servicio-enfermero-profesional.html, servicio-eldering.html, servicio-internacion-domiciliaria.html, servicio-cuidados-paliativos.html) se consolidaron en 4 páginas nuevas por categoría, con redirects 301 en `.htaccess`.

---

## 5. Qué revisar después

Una vez que Search Console esté activo, estas son las secciones más útiles:

- **Rendimiento** — qué búsquedas traen visitas, posición promedio, CTR
- **Cobertura** — si hay páginas con errores de indexación
- **Experiencia de página** — Core Web Vitals (velocidad, estabilidad visual)
- **Resultados enriquecidos** — confirma que el JSON-LD de FAQ y servicios fue detectado correctamente

> Tip: los resultados tardan entre 3 y 7 días en aparecer luego de la primera indexación.

---

## 6. Validar el JSON-LD (rich results)

Para confirmar que los schemas estructurados están bien formados antes de que Google los procese:

1. Ir a: https://search.google.com/test/rich-results
2. Ingresar la URL a testear, por ejemplo: `https://longevityargentina.com/faq.html`
3. Verificar que detecta **FAQPage** sin errores
4. Repetir para `https://longevityargentina.com` — debe detectar **MedicalBusiness**
