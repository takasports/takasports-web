// Intro de la portada: el MISMO revelado que la app (takasports-app ·
// AnimatedSplash) y que la careta de los reels ("OUTRO V1"). El isotipo entra
// con motion blur vertical y el wordmark "TAKA SPORTS" se desliza desde la
// derecha; al terminar, el logo vuela hasta el de la cabecera.
//
// No hay componente de React: la hace ENTERA este script inline, al principio
// del <body> del layout raíz, más el CSS de `html[data-intro]` (globals.css).
// Dos versiones anteriores la montaban desde React tras hidratar y fallaban
// por lo mismo: llegaba tarde. La portada se veía hasta 2 s antes de que la
// tapara (portada → negro → portada), y en un móvil medio React no arranca
// hasta ~3,2 s. Así la cortina sale en el primer pintado, como el splash de la
// app, y nada depende de cuándo hidrate React.
//
// Por qué un script en el layout y no en la portada: la portada llega en
// streaming DETRÁS del esqueleto de loading.tsx, que se pintaría antes.
//
// Fases (atributo data-intro en <html>; el CSS hace el resto):
//   "1"    cortina (fondo + resplandor) mientras llega la tira de fotogramas
//   "play" revelado: 12 fotogramas a 40 ms (los 25 fps del original)
//   "fly"  el logo se encoge hasta el de la cabecera y el fondo se aclara
//   "out"  salida rápida: clic para saltar, o algo no llegó a tiempo
// Al acabar se quita el atributo. Una vez por sesión, solo en "/", nunca con
// reduced-motion ni para rastreadores (Googlebot no guarda sessionStorage:
// vería la cortina en cada rastreo).

export const INTRO_SESSION_KEY = 'ts_signal_intro_shown'

// Los 12 fotogramas en UNA tira vertical (759×222 cada uno, el recorte
// original): una sola petición y una sola decodificación, así que el revelado
// no puede saltarse fotogramas a medio cargar. Con el motion blur horneado no
// se puede recrear con transforms. Caché `immutable` de un año (next.config):
// si cambia, cambiar el NOMBRE.
export const INTRO_SPRITE = '/intro/v2/reveal-sprite.webp'
// Se pide con prioridad ALTA: mientras la cortina tapa, nada de lo que hay
// debajo se ve, así que la tira es lo único que importa. Con la prioridad por
// defecto (baja, como cualquier imagen) un móvil medio con 4G tardaba 1,5 s
// en tenerla, compitiendo con el JS y la foto de portada.

const FRAME_W = 759
const FRAME_H = 222
// Ancho del logo en pantalla: el mismo min(280px, 70vw) de la app. Tiene que
// coincidir con --ts-intro-w de globals.css.
const MAX_W = 280
const VW_RATIO = 0.7

const T = {
  // Si la tira no ha llegado en esto, no hay intro: la cortina se va.
  spriteTimeout: 1500,
  reveal: 440, // 11 saltos × 40 ms
  hold: 400,
  // Tras el revelado, se espera a que la portada (y su logo de cabecera) esté
  // pintada para volar hasta él, como el splash de la app espera a los datos.
  // Tope contado desde el arranque: si no llega, salida rápida.
  headerDeadline: 3200,
  fly: 760, // vuelo 560 ms + fundido del aterrizaje (ver globals.css)
  out: 300,
}

export const INTRO_BOOT_SCRIPT = `(function(){var d=document,h=d.documentElement;try{
if(location.pathname!=='/')return;
var K=${JSON.stringify(INTRO_SESSION_KEY)};
if(sessionStorage.getItem(K)==='1')return;
if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
if(/bot|crawl|spider|slurp|facebookexternalhit|embedly|preview/i.test(navigator.userAgent))return;
sessionStorage.setItem(K,'1');
h.setAttribute('data-intro','1');
var t0=Date.now(),done=false,timers=[];
function at(ms,f){timers.push(setTimeout(f,ms))}
function end(){if(done)return;done=true;timers.forEach(clearTimeout);d.removeEventListener('click',skip,true);h.removeAttribute('data-intro');['--ti-x','--ti-y','--ti-s'].forEach(function(p){h.style.removeProperty(p)});if(!h.getAttribute('style'))h.removeAttribute('style')}
function out(){if(done)return;timers.forEach(clearTimeout);timers=[];h.setAttribute('data-intro','out');at(${T.out},end)}
function skip(e){e.preventDefault();e.stopPropagation();out()}
d.addEventListener('click',skip,true);
function logo(){var a=d.querySelectorAll('img[alt="TakaSports"]');for(var i=0;i<a.length;i++){var r=a[i].getBoundingClientRect();if(r.width>40&&r.top>=0&&r.top<120)return r}return null}
function fly(){var r=logo();if(!r)return out();var vw=h.clientWidth,vh=h.clientHeight,w=Math.min(${MAX_W},vw*${VW_RATIO}),hh=w*${FRAME_H}/${FRAME_W};
h.style.setProperty('--ti-x',(r.left-(vw-w)/2)+'px');h.style.setProperty('--ti-y',(r.top-(vh-hh)/2)+'px');h.style.setProperty('--ti-s',String(r.width/w));
d.removeEventListener('click',skip,true);h.setAttribute('data-intro','fly');at(${T.fly},end)}
function wait(){if(logo())fly();else if(Date.now()-t0>${T.headerDeadline})out();else at(100,wait)}
var img=new Image();img.fetchPriority='high';img.src=${JSON.stringify(INTRO_SPRITE)};
(img.decode?img.decode():new Promise(function(y,n){img.onload=y;img.onerror=n})).then(function(){if(done||h.getAttribute('data-intro')!=='1')return;h.setAttribute('data-intro','play');at(${T.reveal + T.hold},wait)},out);
at(${T.spriteTimeout},function(){if(h.getAttribute('data-intro')==='1')out()});
}catch(e){try{h.removeAttribute('data-intro')}catch(_){}}})();`
