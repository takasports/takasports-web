// ─────────────────────────────────────────────────────────────────────────────
// Plantilla HTML (y texto plano) del correo semanal. Pura: recibe el contenido
// ya elegido y devuelve cadenas.
//
// Reglas de correo, no de web:
//   · Maquetado con TABLAS y estilos EN LÍNEA. Gmail recorta <style> en
//     algunos casos y Outlook de escritorio pinta con el motor de Word.
//   · Ancho fijo de 600 px con `max-width:100%` y una media query para móvil.
//   · Fuentes: Barlow / Barlow Condensed si el cliente las carga (Apple Mail,
//     iOS); si no, cae a Helvetica/Arial con el mismo peso. Nada depende de ellas.
//   · Fondo oscuro de marca declarado TRES veces (bgcolor, background y
//     color-scheme) para que los modos oscuros no lo «inviertan» a claro.
//   · Todo funciona con las imágenes bloqueadas: la única foto es la de la
//     noticia de apertura, con texto alternativo, y el logo lleva alt visible.
//
// La baja va por destinatario: el HTML se pinta UNA vez con el marcador
// BAJA_MARCADOR y el envío lo sustituye por la URL firmada de cada uno.
// ─────────────────────────────────────────────────────────────────────────────

import { accentForSport } from '@/lib/sports'
import {
  asuntoSemanal, conUtm, fechaLarga, preheaderSemanal,
  type ContenidoSemanal, type FilaClasificacion, type NoticiaCorreo,
} from './semanal'

export const BAJA_MARCADOR = '%%TAKA_BAJA_URL%%'

const SITE_LOGO = 'https://www.takasportsmedia.com/taka-logo.png'

const C = {
  fondo: '#09090F',
  tarjeta: '#12121C',
  borde: '#23233A',
  titulo: '#F4F4FA',
  texto: '#B9B9CC',
  apagado: '#8484A0',
  violeta: '#7C3AED',
  violetaTexto: '#A78BFA',
  acento: '#FF4D2E',
  sube: '#34D399',
}

const SANS = "'Barlow', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const COND = "'Barlow Condensed', 'Arial Narrow', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** Escapa texto para HTML (contenido y atributos). */
export function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string
  ))
}

function etiquetaSeccion(texto: string): string {
  return `<tr><td class="px" style="padding:36px 32px 14px 32px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:18px;height:3px;background:${C.acento};font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding-left:10px;font-family:${COND};font-size:14px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${C.violetaTexto};">${esc(texto)}</td>
  </tr></table>
</td></tr>`
}

function boton(texto: string, url: string, fondo = C.violeta, color = '#FFFFFF'): string {
  // Botón «a prueba de balas»: celda con bgcolor + enlace con padding. Outlook
  // ignora el padding del <a> pero pinta la celda, así que sigue siendo botón.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td align="center" bgcolor="${fondo}" style="background:${fondo};border-radius:10px;">
    <a href="${esc(url)}" style="display:inline-block;padding:13px 24px;font-family:${COND};font-size:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};text-decoration:none;border-radius:10px;">${esc(texto)}</a>
  </td>
</tr></table>`
}

function chip(texto: string, color: string): string {
  return `<span style="display:inline-block;padding:3px 9px;border:1px solid ${color};border-radius:999px;font-family:${COND};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${color};">${esc(texto)}</span>`
}

function etiquetaDeporte(n: NoticiaCorreo): string {
  return n.competicion || etiquetaSlug(n.deporte) || 'Deportes'
}

function etiquetaSlug(slug: string | null): string | null {
  if (!slug) return null
  const mapa: Record<string, string> = {
    futbol: 'Fútbol', baloncesto: 'Baloncesto', nba: 'NBA', formula1: 'F1', tenis: 'Tenis',
    ufc: 'UFC', wwe: 'Lucha libre', rugby: 'Rugby', padel: 'Pádel', golf: 'Golf', motogp: 'MotoGP',
  }
  return mapa[slug.toLowerCase()] ?? slug
}

function apertura(n: NoticiaCorreo): string {
  const color = accentForSport(n.deporte)
  const foto = n.imagen
    ? `<tr><td style="padding:0;font-size:0;line-height:0;">
        <a href="${esc(n.url)}"><img src="${esc(n.imagen)}" width="600" alt="${esc(n.titulo)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:16px 16px 0 0;background:${C.tarjeta};color:${C.apagado};font-family:${SANS};font-size:13px;line-height:1.4;"></a>
      </td></tr>`
    : ''
  return `<tr><td class="px" style="padding:8px 32px 0 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.tarjeta}" style="background:${C.tarjeta};border:1px solid ${C.borde};border-radius:16px;">
    ${foto}
    <tr><td style="padding:22px 24px 26px 24px;">
      ${chip(etiquetaDeporte(n), color)}
      <h1 class="h1" style="margin:14px 0 10px 0;font-family:${COND};font-size:30px;line-height:1.08;font-weight:800;color:${C.titulo};letter-spacing:-0.01em;">
        <a href="${esc(n.url)}" style="color:${C.titulo};text-decoration:none;">${esc(n.titulo)}</a>
      </h1>
      ${n.resumen ? `<p style="margin:0 0 20px 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${C.texto};">${esc(n.resumen)}</p>` : ''}
      ${boton('Leer la noticia', n.url)}
    </td></tr>
  </table>
</td></tr>`
}

function filaNoticia(n: NoticiaCorreo, ultima: boolean): string {
  const color = accentForSport(n.deporte)
  return `<tr><td style="padding:16px 0;${ultima ? '' : `border-bottom:1px solid ${C.borde};`}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="4" style="width:4px;background:${color};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding-left:14px;">
      <p style="margin:0 0 5px 0;font-family:${COND};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${color};">${esc(etiquetaDeporte(n))}</p>
      <a href="${esc(n.url)}" style="font-family:${SANS};font-size:17px;line-height:1.35;font-weight:700;color:${C.titulo};text-decoration:none;">${esc(n.titulo)}</a>
    </td>
  </tr></table>
</td></tr>`
}

function bloqueTarjeta(filas: string): string {
  return `<tr><td class="px" style="padding:0 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.tarjeta}" style="background:${C.tarjeta};border:1px solid ${C.borde};border-radius:16px;">
    <tr><td style="padding:4px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${filas}</table>
    </td></tr>
  </table>
</td></tr>`
}

function notaPie(texto: string): string {
  return `<tr><td class="px" style="padding:10px 32px 0 32px;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.apagado};">${texto}</td></tr>`
}

function enlaceVerMas(texto: string, url: string): string {
  return `<tr><td class="px" style="padding:12px 32px 0 32px;">
  <a href="${esc(url)}" style="font-family:${COND};font-size:15px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.violetaTexto};text-decoration:none;">${esc(texto)} &rarr;</a>
</td></tr>`
}

function filaClasificacion(f: FilaClasificacion, extra: string, ultima: boolean): string {
  const medalla = f.puesto === 1 ? C.acento : f.puesto <= 3 ? C.violetaTexto : C.apagado
  return `<tr>
  <td width="34" style="padding:11px 0;${ultima ? '' : `border-bottom:1px solid ${C.borde};`}font-family:${COND};font-size:20px;font-weight:800;color:${medalla};">${f.puesto}</td>
  <td style="padding:11px 0;${ultima ? '' : `border-bottom:1px solid ${C.borde};`}font-family:${SANS};font-size:15px;font-weight:600;color:${C.titulo};">${esc(f.nombre)}${extra ? `<span style="font-weight:400;color:${C.apagado};font-size:13px;"> · ${esc(extra)}</span>` : ''}</td>
  <td align="right" style="padding:11px 0;${ultima ? '' : `border-bottom:1px solid ${C.borde};`}font-family:${COND};font-size:18px;font-weight:700;color:${C.titulo};white-space:nowrap;">${f.puntos} <span style="font-size:12px;color:${C.apagado};font-weight:600;">PTS</span></td>
</tr>`
}

export interface OpcionesRender {
  /** URL de baja del destinatario. Por defecto el marcador, que se sustituye al enviar. */
  bajaUrl?: string
}

export function renderSemanalHtml(c: ContenidoSemanal, opts: OpcionesRender = {}): string {
  const baja = opts.bajaUrl ?? BAJA_MARCADOR
  const camp = c.edicion.clave
  const asunto = asuntoSemanal(c)
  const pre = preheaderSemanal(c)
  const [cabeza, ...resto] = c.destacadas

  const partes: string[] = []

  // ── Apertura + deporte a deporte
  if (cabeza) {
    partes.push(apertura(cabeza))
  }
  if (resto.length) {
    partes.push(etiquetaSeccion('La semana, deporte a deporte'))
    partes.push(bloqueTarjeta(resto.map((n, i) => filaNoticia(n, i === resto.length - 1)).join('')))
  }

  // ── Partidos de la semana que empieza
  if (c.partidos.length) {
    partes.push(etiquetaSeccion('Los partidos de la semana'))
    const filas = c.partidos.map((p, i) => {
      const ultima = i === c.partidos.length - 1
      const color = accentForSport(p.sport)
      const linea = ultima ? '' : `border-bottom:1px solid ${C.borde};`
      return `<tr>
  <td width="74" valign="top" style="padding:14px 0;${linea}">
    <p style="margin:0;font-family:${COND};font-size:16px;font-weight:800;text-transform:uppercase;color:${C.titulo};">${esc(p.dia)}</p>
    <p style="margin:2px 0 0 0;font-family:${COND};font-size:15px;font-weight:600;color:${C.apagado};">${esc(p.hora || '—')}</p>
  </td>
  <td valign="top" style="padding:14px 0;${linea}">
    <a href="${esc(p.url)}" style="font-family:${SANS};font-size:16px;line-height:1.3;font-weight:700;color:${C.titulo};text-decoration:none;">${esc(p.titulo)}</a>
    <p style="margin:4px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.4;color:${C.apagado};"><span style="color:${color};font-weight:700;">${esc(p.comp)}</span>${p.canal ? ` · ${esc(p.canal)}` : ''}</p>
  </td>
  <td width="96" align="right" valign="top" class="hide-m" style="padding:14px 0;${linea}">${p.motivo ? chip(p.motivo, C.acento) : ''}</td>
</tr>`
    }).join('')
    partes.push(bloqueTarjeta(filas))
    partes.push(notaPie('Horas peninsulares de España. Todo el calendario, con resultados y canales, en la web.'))
    partes.push(enlaceVerMas('Ver el calendario', conUtm('/calendario', camp, 'partidos')))
  }

  // ── Lo más leído
  if (c.masLeidas.length) {
    partes.push(etiquetaSeccion('Lo más leído'))
    const filas = c.masLeidas.map((n, i) => {
      const linea = i === c.masLeidas.length - 1 ? '' : `border-bottom:1px solid ${C.borde};`
      return `<tr>
  <td width="40" valign="top" style="padding:14px 0;${linea}font-family:${COND};font-size:30px;line-height:1;font-weight:800;color:${C.acento};">${i + 1}</td>
  <td valign="top" style="padding:14px 0;${linea}">
    <a href="${esc(n.url)}" style="font-family:${SANS};font-size:16px;line-height:1.35;font-weight:700;color:${C.titulo};text-decoration:none;">${esc(n.titulo)}</a>
  </td>
</tr>`
    }).join('')
    partes.push(bloqueTarjeta(filas))
    if (c.masLeidasVentana) partes.push(notaPie(`Lo que más se abrió desde Google ${esc(c.masLeidasVentana)}.`))
  }

  // ── Ranking Taka
  if (c.movimientos.length) {
    partes.push(etiquetaSeccion('Ranking Taka · Quién sube'))
    const filas = c.movimientos.map((m, i) => {
      const linea = i === c.movimientos.length - 1 ? '' : `border-bottom:1px solid ${C.borde};`
      return `<tr>
  <td valign="top" style="padding:14px 0;${linea}">
    <a href="${esc(m.url)}" style="font-family:${SANS};font-size:16px;font-weight:700;color:${C.titulo};text-decoration:none;">${m.bandera ? `${esc(m.bandera)} ` : ''}${esc(m.nombre)}</a>
    ${m.detalle ? `<p style="margin:3px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.4;color:${C.apagado};">${esc(m.detalle)}</p>` : ''}
  </td>
  <td width="110" align="right" valign="top" style="padding:14px 0;${linea}white-space:nowrap;">
    <span style="font-family:${COND};font-size:20px;font-weight:800;color:${C.sube};">+${m.delta.toFixed(1)}</span>
    <p style="margin:2px 0 0 0;font-family:${COND};font-size:13px;font-weight:600;color:${C.apagado};">ÍNDICE ${m.score.toFixed(1)}</p>
  </td>
</tr>`
    }).join('')
    partes.push(bloqueTarjeta(filas))
    partes.push(enlaceVerMas('Ver el Ranking Taka', conUtm('/rankings', camp, 'ranking')))
  }

  // ── Liga Taka / Jornada
  const lt = c.ligaTaka
  if (lt.jornada.length || lt.general.length || lt.abierta) {
    partes.push(etiquetaSeccion('Liga Taka'))
    const bloques: string[] = []
    if (lt.jornada.length) {
      bloques.push(`<tr><td style="padding:16px 0 4px 0;font-family:${COND};font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.apagado};">Jornada de la semana pasada · ${lt.jornadaParticipantes} ${lt.jornadaParticipantes === 1 ? 'jugador' : 'jugadores'}</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lt.jornada.map((f, i) => filaClasificacion(f, f.aciertos != null ? `${f.aciertos} aciertos` : '', i === lt.jornada.length - 1)).join('')}</table></td></tr>`)
    }
    if (lt.general.length) {
      bloques.push(`<tr><td style="padding:16px 0 4px 0;font-family:${COND};font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.apagado};">Clasificación general</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lt.general.map((f, i) => filaClasificacion(f, '', i === lt.general.length - 1)).join('')}</table></td></tr>`)
    }
    if (lt.abierta) {
      bloques.push(`<tr><td style="padding:18px 0 20px 0;${bloques.length ? `border-top:1px solid ${C.borde};` : ''}">
  <p style="margin:0 0 6px 0;font-family:${COND};font-size:20px;font-weight:800;color:${C.titulo};">La Jornada nueva ya está abierta</p>
  <p style="margin:0 0 16px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.texto};">${lt.abierta.partidos} partidos para pronosticar${lt.abierta.estrella ? `, con ${esc(lt.abierta.estrella)} como partido estrella` : ''}. Acierta y sube en la general.</p>
  ${boton('Hacer mis pronósticos', lt.abierta.url)}
</td></tr>`)
    }
    partes.push(bloqueTarjeta(bloques.join('')))
  }

  // ── Juego de la semana
  partes.push(etiquetaSeccion('El juego de la semana'))
  partes.push(`<tr><td class="px" style="padding:0 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1A1030" style="background:#1A1030;border:1px solid ${C.violeta};border-radius:16px;">
    <tr><td style="padding:24px;">
      <p style="margin:0 0 4px 0;font-family:${COND};font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.acento};">${esc(c.juego.nombre)}</p>
      <p style="margin:0 0 10px 0;font-family:${COND};font-size:26px;line-height:1.1;font-weight:800;color:${C.titulo};">${esc(c.juego.titulo)}</p>
      <p style="margin:0 0 20px 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.texto};">${esc(c.juego.descripcion)}</p>
      ${boton('Jugar ahora', c.juego.url, C.acento, '#09090F')}
    </td></tr>
  </table>
</td></tr>`)
  partes.push(notaPie(`Y cada día, un CrackQuiz y un TakaGrid nuevos en <a href="${esc(conUtm('/juegos', camp, 'juegos'))}" style="color:${C.violetaTexto};text-decoration:none;">Juegos</a>.`))

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(asunto)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  u + #body a { color: inherit; text-decoration: none; }
  @media only screen and (max-width: 620px) {
    .wrap { width: 100% !important; }
    .px { padding-left: 16px !important; padding-right: 16px !important; }
    .h1 { font-size: 26px !important; }
    .hide-m { display: none !important; }
  }
</style>
</head>
<body id="body" bgcolor="${C.fondo}" style="margin:0;padding:0;width:100%;background:${C.fondo};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.fondo};opacity:0;">${esc(pre)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.fondo}" style="background:${C.fondo};">
<tr><td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

  <tr><td class="px" style="padding:32px 32px 6px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle">
        <a href="${esc(conUtm('/', camp, 'cabecera'))}" style="text-decoration:none;"><img src="${SITE_LOGO}" width="132" height="38" alt="TAKASPORTS" style="display:block;width:132px;height:auto;border:0;font-family:${COND};font-size:22px;font-weight:800;letter-spacing:0.08em;color:${C.titulo};"></a>
      </td>
      <td valign="middle" align="right" style="font-family:${COND};font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.apagado};">Semanal · Nº ${c.edicion.numero}</td>
    </tr></table>
  </td></tr>

  <tr><td class="px" style="padding:22px 32px 18px 32px;">
    <p style="margin:0 0 6px 0;font-family:${COND};font-size:14px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.acento};">${esc(capitalizar(fechaLarga(c.edicion.lunes)))}</p>
    <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.5;color:${C.texto};">Lo que pasó la semana pasada y lo que viene en esta, en cinco minutos.</p>
  </td></tr>

  ${partes.join('\n')}

  <tr><td class="px" style="padding:44px 32px 40px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="border-top:1px solid ${C.borde};padding-top:24px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.apagado};">
        Recibes este correo porque te suscribiste a la newsletter de TakaSports en takasportsmedia.com.<br>
        <a href="${esc(baja)}" style="color:${C.violetaTexto};text-decoration:underline;">Darme de baja</a>
        &nbsp;·&nbsp; <a href="${esc(conUtm('/contacto', camp, 'pie'))}" style="color:${C.apagado};text-decoration:underline;">Contacto</a>
        &nbsp;·&nbsp; <a href="${esc(conUtm('/privacidad', camp, 'pie'))}" style="color:${C.apagado};text-decoration:underline;">Privacidad</a><br><br>
        TakaSports · <a href="${esc(conUtm('/', camp, 'pie'))}" style="color:${C.apagado};text-decoration:none;">takasportsmedia.com</a>
      </td></tr>
    </table>
  </td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Versión en texto plano (multipart/alternative): la leen los clientes sin
 *  HTML y cuenta para los filtros de spam. */
export function renderSemanalTexto(c: ContenidoSemanal, opts: OpcionesRender = {}): string {
  const baja = opts.bajaUrl ?? BAJA_MARCADOR
  const camp = c.edicion.clave
  const l: string[] = []
  l.push(`TAKA SEMANAL · Nº ${c.edicion.numero} · ${capitalizar(fechaLarga(c.edicion.lunes))}`)
  l.push('Lo que pasó la semana pasada y lo que viene en esta.')
  l.push('')
  const [cabeza, ...resto] = c.destacadas
  if (cabeza) {
    l.push(`>> ${cabeza.titulo}`)
    if (cabeza.resumen) l.push(cabeza.resumen)
    l.push(cabeza.url, '')
  }
  if (resto.length) {
    l.push('LA SEMANA, DEPORTE A DEPORTE')
    for (const n of resto) l.push(`- [${etiquetaDeporte(n)}] ${n.titulo}`, `  ${n.url}`)
    l.push('')
  }
  if (c.partidos.length) {
    l.push('LOS PARTIDOS DE LA SEMANA (hora peninsular)')
    for (const p of c.partidos) l.push(`- ${p.dia} ${p.hora || ''} · ${p.titulo} (${p.comp}${p.canal ? `, ${p.canal}` : ''})`.replace('  ', ' '), `  ${p.url}`)
    l.push(`Calendario completo: ${conUtm('/calendario', camp, 'partidos')}`, '')
  }
  if (c.masLeidas.length) {
    l.push('LO MÁS LEÍDO')
    c.masLeidas.forEach((n, i) => l.push(`${i + 1}. ${n.titulo}`, `   ${n.url}`))
    l.push('')
  }
  if (c.movimientos.length) {
    l.push('RANKING TAKA · QUIÉN SUBE')
    for (const m of c.movimientos) l.push(`- ${m.nombre} +${m.delta.toFixed(1)} (índice ${m.score.toFixed(1)})`, `  ${m.url}`)
    l.push('')
  }
  const lt = c.ligaTaka
  if (lt.jornada.length || lt.general.length || lt.abierta) {
    l.push('LIGA TAKA')
    if (lt.jornada.length) {
      l.push('Jornada de la semana pasada:')
      for (const f of lt.jornada) l.push(`${f.puesto}. ${f.nombre} — ${f.puntos} pts`)
    }
    if (lt.general.length) {
      l.push('Clasificación general:')
      for (const f of lt.general) l.push(`${f.puesto}. ${f.nombre} — ${f.puntos} pts`)
    }
    if (lt.abierta) l.push(`La Jornada nueva ya está abierta: ${lt.abierta.partidos} partidos. ${lt.abierta.url}`)
    l.push('')
  }
  l.push(`EL JUEGO DE LA SEMANA: ${c.juego.nombre} — ${c.juego.titulo}`, c.juego.descripcion, c.juego.url, '')
  l.push('—')
  l.push('Recibes este correo porque te suscribiste a la newsletter de TakaSports.')
  l.push(`Darte de baja: ${baja}`)
  return l.join('\n')
}
