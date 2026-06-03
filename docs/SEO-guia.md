# 📈 Guía: "Cómo ver mi posicionamiento" (SEO de TakaSports)

> Guía pensada para alguien que **nunca ha hecho SEO**. Cada palabra técnica se explica
> la primera vez que aparece. Si solo tienes 15 minutos, salta al
> [Checklist semanal](#-checklist-semanal-de-15-minutos).
>
> **Datos de esta guía:** capturas reales de tu cuenta tomadas el **2 de junio de 2026**
> (compartidas en el chat de la sesión). Versión visual y formateada para abrir en el
> navegador: `~/Desktop/Guia-SEO-TakaSports.html`.

---

## 0. ¿Qué es esto del "posicionamiento"? (en 30 segundos)

Cuando alguien busca en Google "diego simeone" o "crocs f1", Google muestra una lista de
resultados. **Posicionamiento (SEO)** = en qué puesto de esa lista aparecen tus artículos
de TakaSports. Cuanto más arriba, más gente entra. El objetivo de esta guía es enseñarte a
**mirar si vas subiendo o bajando** y **detectar problemas antes de que te cuesten visitas**.

No necesitas tocar código. Solo entrar a 3 páginas web gratuitas y leer unos números.

---

## 1. Las 3 herramientas (y para qué sirve cada una)

| Herramienta | En una frase | Cuándo la miras |
|---|---|---|
| **Google Search Console (GSC)** | Te dice **qué busca la gente en Google** para llegar a ti y en qué puesto sales. También avisa si Google **no puede leer** tus páginas. | A diario / semanal. Es la más importante. |
| **Google Analytics 4 (GA4)** | Te dice **qué hace la gente una vez está dentro** de la web (cuántos son, de dónde vienen, qué leen). | Semanal. |
| **PageSpeed Insights** | Te dice si tu web **carga rápido** y si está bien hecha técnicamente. Pone notas de 0 a 100. | Cuando cambias el diseño o 1 vez al mes. |

**Regla mental:** GSC = *antes* del clic (en Google). GA4 = *después* del clic (dentro de tu web). PageSpeed = *salud técnica* de la web.

---

## 2. Diccionario rápido (los 7 términos que vas a leer todo el rato)

- **Impresión:** tu artículo **apareció** en Google cuando alguien buscó algo. No quiere decir que entraran, solo que lo vieron en la lista.
- **Clic:** alguien **pinchó** y entró en tu artículo.
- **CTR** (*Click-Through Rate*): de cada 100 personas que vieron tu resultado, cuántas pincharon. `CTR = clics ÷ impresiones`. Un CTR de 1,2 % = de cada 100 que te ven, ~1 entra.
- **Posición media:** el puesto medio en el que sales. **Más bajo es mejor** (posición 1 = primero; posición 19 = casi al final de la 2ª página).
- **Consulta / Query:** la palabra o frase que la gente escribió en Google ("diego simeone").
- **Indexar:** que Google haya **guardado** tu página en su biblioteca. Si una página **no está indexada, no puede aparecer nunca** en Google.
- **Canonical:** una etiqueta que le dice a Google "esta es la versión oficial de esta página" (evita que penalice por contenido duplicado).

---

## 3. Google Search Console — paso a paso

### 3.1 Cómo entrar
1. Ve a **[search.google.com/search-console](https://search.google.com/search-console)**
2. Inicia sesión con tu cuenta de Google (la que ya tiene TakaSports verificada).
3. Arriba a la izquierda comprueba que la propiedad seleccionada sea **`https://www.takasportsmedia.com/`**.

### 3.2 La pantalla "Rendimiento" → los 4 números que importan
**Dónde:** menú izquierdo → **Rendimiento**.

> 📸 **En tu pantalla verás:** 4 recuadros arriba (Clics totales, Impresiones totales, CTR medio, Posición media) y una gráfica que sube hacia la derecha.

Arriba ves 4 recuadros. Esto es lo que significan **con tus datos reales (últimos 3 meses)**:

| Recuadro | Tu dato | Qué significa | ¿Bueno o malo? |
|---|---|---|---|
| **Clics totales** | **206** | Gente que entró desde Google en 3 meses | Es poco aún, pero **va subiendo** (mira la gráfica: sube hacia la derecha) ✅ |
| **Impresiones totales** | **16,9 mil** | Veces que apareciste en Google | Bien — Google ya te enseña mucho |
| **CTR medio** | **1,2 %** | De cada 100 que te ven, ~1 entra | **Bajo.** Lo normal sano es 2–5 %. Aquí está la mayor oportunidad 👉 mejorar títulos |
| **Posición media** | **19,4** | Sales sobre el puesto 19 (final de la 2ª página) | Mejorable. Bajar de 19 a <10 (1ª página) multiplica los clics |

> ⚠️ **Truco para leer la gráfica:** activa las casillas de los 4 recuadros (clic encima) para ver las 4 líneas a la vez. Lo que buscas es que **clics e impresiones suban** y que **la posición baje** (recuerda: en posición, bajar = mejor).

**Cambia el periodo** con los botones de arriba (`24 horas`, `7 días`, `28 días`, `3 meses`). Para ver tendencia usa **3 meses**; para ver "¿pasó algo raro ayer?" usa **7 días**.

### 3.3 Pestaña "Consultas" → con qué palabras te encuentran
**Dónde:** en la misma pantalla de Rendimiento, baja un poco y verás pestañas **CONSULTAS / PÁGINAS / PAÍSES…**. Quédate en **CONSULTAS**.

> 📸 **En tu pantalla verás:** una tabla con tus consultas reales y sus clics/impresiones.

Aquí ves por qué palabras entra la gente. Tus datos reales:

| Consulta | Clics | Impresiones | Lectura |
|---|---|---|---|
| diego simeone | 15 | 89 | 👍 Buen CTR (17 %): de los que te ven, muchos entran |
| thiago almada | 12 | 122 | 👍 Sano |
| camino del psg en champions 2026 | 8 | 214 | 👍 |
| **crocs f1** | **3** | **1.861** | 🚨 **Problema/oportunidad gigante** (ver abajo) |
| marcelo bielsa | 3 | 67 | OK |

#### 🔎 El caso "crocs f1" — cómo se lee y qué hacer
- **Qué pasa:** apareciste **1.861 veces** en Google por "crocs f1", pero solo **3 personas** entraron. Eso es un **CTR del 0,16 %** (de cada 1.000 que te ven, ni 2 entran).
- **Qué significa:** Google **sí te muestra** (bien), pero tu **título y descripción no convencen** a la gente para pinchar. O sales en una posición baja. O el contenido no encaja con lo que buscan.
- **Qué hacer (acción concreta):**
  1. Busca tú mismo "crocs f1" en Google y mira con qué título sales.
  2. En **Sanity** (el CMS), abre ese artículo y reescribe el **título SEO** y la **meta-descripción** para que sean irresistibles y contengan las palabras "crocs" y "F1". Ej: *"Crocs en la F1: por qué los pilotos llevan estos zapatos en el paddock"*.
  3. Espera 1–2 semanas y vuelve a mirar el CTR de esa consulta. Si sube del 0,16 % a >1 %, funcionó.

> **Idea clave:** una consulta con **muchas impresiones y pocos clics** = dinero tirado. Google ya te regala visibilidad; solo tienes que mejorar el título para recogerla.

### 3.4 "Indexación / Páginas" → ¿Google puede leer tu web?
**Dónde:** menú izquierdo → **Indexación → Páginas**.

> 📸 **En tu pantalla verás:** dos números grandes — Indexadas (verde) y Sin indexar (gris).

Dos números:
- **Indexadas: 4,5 mil** ✅ — páginas que Google guardó y puede mostrar. **Que este número crezca con el tiempo es buena señal.**
- **Sin indexar: 2,13 mil** — páginas que Google decidió NO guardar. **No te asustes:** una parte es normal (etiquetas, páginas duplicadas con canonical, etc.). Lo que hay que vigilar son ciertos motivos concretos 👇.

Baja en esa misma pantalla hasta **"¿Por qué hay páginas que no se indexan?"**:

> 📸 **En tu pantalla verás:** la tabla "¿Por qué hay páginas que no se indexan?" con los motivos.

| Motivo | Páginas | ¿Preocupa? |
|---|---|---|
| Excluida por etiqueta "noindex" | 54 | ✅ Normal (tú le dijiste a Google que no la guardara) |
| Página alternativa con canónica adecuada | 43 | ✅ Normal (duplicados resueltos bien) |
| **Soft 404** | **4** | ⚠️ **Vigilar** — páginas que parecen vacías/error |
| **Error de servidor (5xx)** | **3** | 🚨 **ALERTA** — Google entró y tu web le devolvió un error |
| Descubierta: actualmente sin indexar | 1.652 | 😐 Google las conoce pero aún no las ha guardado (paciencia) |

> 🚨 **El motivo "Error de servidor (5xx)" es EL importante.** Es exactamente el tipo de fallo que tuvo la web 23 horas sin avisar. Si este número **sube de golpe**, algo se rompió en el deploy. → Esto es lo que la **auditoría diaria de Telegram** (Tarea 2) va a vigilar por ti automáticamente.

---

## 4. Google Analytics 4 — paso a paso

GA4 es el "después del clic": qué hace la gente **dentro** de tu web.

**Cómo entrar:** [analytics.google.com](https://analytics.google.com) → cuenta **KunJt** → propiedad **"Deportes"**.

> 📸 **En tu pantalla verás:** la pantalla Inicio con Usuarios activos, Número de eventos y "Usuarios activos por minuto" (en directo).

En la pantalla **Inicio** ves de un vistazo (últimos 7 días, tus datos reales):
- **Usuarios activos: 20** — personas distintas que entraron.
- **Número de eventos: 83** — acciones que hicieron (ver página, hacer scroll, clic…).
- **Usuarios activos por minuto (derecha):** los que están **ahora mismo** en la web. Útil cuando publicas algo y quieres ver si entra gente en directo.

**Las 2 pantallas de GA4 que más te sirven:**
1. **Tiempo real** (menú izquierdo, icono del reloj): "¿hay gente ahora?". Ideal justo después de publicar.
2. **Informes → Adquisición → Adquisición de tráfico**: te dice **de dónde viene** la gente (Google = *Organic Search*, redes = *Social*, directo, etc.). Para SEO te interesa que **"Organic Search" crezca**.

> 💡 **¿Por qué GA4 marca menos visitas que GSC a veces?** Porque GA4 solo cuenta a quien **acepta cookies** o pasa el Consentimiento. Tienes **Consent Mode v2** activo, así que GA4 estima bastante bien el tráfico real, pero **para SEO puro fíate más de GSC** (mide directamente desde Google).

---

## 5. PageSpeed Insights — ¿tu web carga rápido?

**Cómo entrar:** [pagespeed.web.dev](https://pagespeed.web.dev) → pega `https://www.takasportsmedia.com/` → **Analizar**. Tarda ~30 segundos. Mira tanto **Celulares** como **Escritorio**.

> 📸 **En tu pantalla verás:** 4 círculos con notas de 0 a 100 (Rendimiento, Accesibilidad, Recomendaciones, SEO).

Da 4 notas de 0 a 100 (tus datos reales en **móvil**):

| Nota | Tu puntuación | Lectura |
|---|---|---|
| **Rendimiento** | **56** 🟠 | Velocidad de carga en móvil. **Es lo más flojo.** <50 rojo, 50–89 naranja, 90+ verde. Objetivo: subir de 56 a >80 |
| **Accesibilidad** | 91 🟢 | Que personas con discapacidad puedan usar la web. Muy bien |
| **Recomendaciones** | 96 🟢 | Buenas prácticas técnicas. Excelente |
| **SEO** | **92** 🟢 | Lo técnico de SEO (etiquetas, enlaces…). **Muy bien** — confirma el ~86/100 global |

> **Verde/Naranja/Rojo:** 90–100 verde (genial), 50–89 naranja (mejorable), 0–49 rojo (arréglalo). Las notas de móvil suelen ser más bajas que las de escritorio — es normal, pero **prioriza móvil** porque la mayoría de tus lectores entran desde el teléfono.
>
> **"Descubre lo que experimentan tus usuarios reales: No hay datos"** → es normal en webs jóvenes: Google necesita más visitantes con Chrome para tener datos "de campo". No es un error.

---

## ✅ Checklist semanal de 15 minutos

Hazlo el mismo día cada semana (ej. lunes por la mañana). De más importante a menos:

1. **[GSC → Indexación → Páginas]** ¿Subió "Error de servidor (5xx)" o "Soft 404"? → Si sí, **algo se rompió**, avisa. *(2 min)*
2. **[GSC → Rendimiento, periodo 7 días]** ¿Clics e impresiones van **arriba** vs la semana pasada? ¿La posición media **baja** (mejora)? *(3 min)*
3. **[GSC → Rendimiento → Consultas]** Busca consultas con **muchas impresiones y pocos clics** (CTR <0,5 %). Apunta 1 para mejorar su título en Sanity esa semana. *(4 min)*
4. **[GSC → Rendimiento → Páginas]** ¿Qué artículo nuevo está despegando? Dale más enlaces internos. *(2 min)*
5. **[GA4 → Adquisición de tráfico]** ¿Crece "Organic Search"? *(2 min)*
6. **[PageSpeed, solo si tocaste el diseño]** ¿La nota de Rendimiento no bajó? *(2 min)*

---

## 🟢🔴 Señales de que va bien / va mal

**Va BIEN si…**
- ✅ Clics e impresiones suben semana a semana (aunque sea poco).
- ✅ La posición media baja (de 19 hacia 10, hacia 5…).
- ✅ El número de páginas **indexadas** crece.
- ✅ Aparecen **consultas nuevas** por las que antes no salías.
- ✅ "Error de servidor (5xx)" se mantiene en 0 o casi.

**Va MAL / atención si…**
- 🔴 **Caída brusca de clics o impresiones** de un día para otro (sin ser festivo/fin de semana) → suele ser un fallo técnico o que Google dejó de indexar algo.
- 🔴 **"Error de servidor (5xx)" sube** → la web devuelve errores a Google. Urgente.
- 🔴 La **posición media empeora** (sube de número) varias semanas seguidas.
- 🔴 **Páginas indexadas bajan** de golpe → Google está sacando páginas de su biblioteca.
- 🔴 Una consulta importante pasa de tener clics a tener 0.

> Las señales rojas son justo lo que la **auditoría diaria por Telegram** (Tarea 2) te va a mandar al móvil cada mañana, para que no tengas que entrar a mirar tú.

---

## Anexo — Glosario de "qué hago si está mal"

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Muchas impresiones, pocos clics (CTR bajo) | Título/meta poco atractivos | Reescribir título y meta-descripción en Sanity |
| Posición media alta (malo) | Contenido corto o poca autoridad | Artículos más largos (1.300–1.800 palabras) y enlaces internos |
| Sube "Error 5xx" | Deploy roto / API caída | Revisar Vercel (último deploy "Ready") y la API que falle |
| Bajan páginas indexadas | Canonical mal, noindex por error | Revisar la página en GSC → "Inspección de URLs" |
| Rendimiento PageSpeed bajo | Imágenes pesadas, JS de más | Revisar imágenes (ya usas WebP) y scripts de terceros |

---

*Guía generada el 2026-06-02 con capturas reales de la cuenta. Para la auditoría automática diaria, ver Tarea 2.*
