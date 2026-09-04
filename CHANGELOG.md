# Registro de cambios

Lo que ha ido cambiando en la web, por meses. No están los 1.383 commits: están
los cambios que se notan. El detalle fino, en `git log`.

Formato: **Nuevo** lo que antes no existía · **Arreglado** lo que estaba roto ·
**Mejor** lo que ya funcionaba y ahora funciona mejor.

---

## Septiembre 2026 — la revisión de producto

Auditoría de las 16 páginas y las 14 pantallas de la app contra producción, y un
plan de 54 cambios en cinco fases. Las fases 0, 1 y 2 están cerradas.

**Arreglado**
- La página de perfil se quedaba **en blanco** para quien no había iniciado
  sesión — y era justo donde caían `/login` y el menú móvil.
- Once **fallos de hidratación**: el navegador tiraba la página entera y la
  repintaba. La portada lo hacía en cada carga. Todos por lo mismo: decidir con
  el reloj del navegador algo que ya venía escrito en un HTML cacheado.
- El **Mundial** terminó en julio y seguía ocupando el menú, las estadísticas y
  el catálogo de juegos.
- La portada recortaba las fotos por el centro y **decapitaba a media portada**.
- El aviso legal no aclaraba que no somos la otra empresa que se llama Taka.

**Mejor**
- **Peso de las imágenes**: `/noticias` pasó de 13,2 a 1,7 MB en móvil; la
  portada, de 14,6 a 1,9 MB. Se pedían fotos de 1.280 px para huecos de 174.
- La portada mandaba **780 partidos para pintar cuatro**: 84 KB en vez de 114.
- **Accesibilidad AA**: 101 incumplimientos de contraste a cero, y los objetivos
  táctiles por debajo de 24 px (WCAG 2.2), también a cero.
- **Tipografía unificada** en Barlow, catálogo de piezas reutilizables y una sola
  tarjeta de noticia donde había cinco copias que iban perdiendo cosas.
- **Modo lectura claro** en el artículo, sin tocar el resto del sitio.
- Los Destacados enseñan **tu liga** si miras desde América.
- Podio por deporte en Rankings, tablet de 768 a 1023 px y bienvenida de 3 pasos.

**Nuevo**
- «**Lo más leído** de la semana» en portada y en cada artículo.
- Bloque «**Tu día**», que sabe qué equipos sigues. **Guardar una noticia** para
  después. Sitemap de partidos (1.097 URLs).
- El **título SEO** ya no depende de un Mac encendido: `/api/cron/seo-title`.
- El panel de tráfico dice **cuánto tráfico no llega a medirse** (las cookies se
  comen más de la mitad).

## Agosto 2026 — predicciones, compartir y calendario

**Nuevo**
- Se puede **pronosticar sin cuenta**: el pick se guarda en el móvil y sube al
  entrar.
- La noticia sale en una **placa 9:16** lista para historias.
- Bloque «**Dónde verlo**», con la fila del país del lector arriba.
- Los **avisos push** llegan por fin a la app (el token de Expo no se leía: era
  un buzón muerto).
- Destacados del calendario como línea de tiempo; ligas plegables.

**Arreglado**
- Cinco partidos llevaban **una semana sin liquidar**, y uno que nadie pronosticó
  no se marcaba nunca como resuelto.
- El Partidazo salía a cara o cruz y el Madrid jugaba dos veces.
- El tenis hablaba en inglés y el US Open se inventaba la hora.
- Las etiquetas competían por rastreo con las páginas que sí responden.

## Julio 2026 — el Índice Taka se automatiza

Este repo pasa a ser **la fuente de verdad del scoring**. Los Equipos y el factor
mediático dejan de puntuarse a mano; los seguidores de Instagram y TikTok pasan a
ser reales y no estimaciones; cada creador se ancla a su canal de YouTube
verificado.

**Nuevo**: `/admin/trafico` — mapamundi interactivo de «de dónde te ven»,
crecimiento diario y descargas de iOS por país.

## Mayo y junio 2026 — construcción

Un millar de commits: noticias, calendario, rankings, predicciones, los cuatro
minijuegos, el perfil, el panel de administración y la API que alimenta la app.

## Abril 2026

Primer commit, el 14.
