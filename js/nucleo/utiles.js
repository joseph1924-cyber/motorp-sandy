/* Utilidades — selectores, fechas, formato de moneda, escapado y avisos
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

const $=id=>document.getElementById(id), uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7), money=n=>Number(n||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}), today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};

const isoDate=(s)=>{const d=new Date(s+'T00:00:00');return isNaN(d)?null:d}, addDays=(s,n)=>{const d=isoDate(s);if(!d)return '';d.setDate(d.getDate()+Number(n||0));return d.toISOString().slice(0,10)};

const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');

function notify(t){const e=$('toast');e.textContent=t;e.classList.toggle('success',/guardad|registrad|actualizad|pagad|activad|desactivad|cancelad|eliminad|restablecid|realizada con éxito/i.test(String(t)));e.style.display='block';setTimeout(()=>e.style.display='none',2200)}

function inRange(d,a,b){return (!a||d>=a)&&(!b||d<=b)}

function fmtDate(s){return s?new Date(s+'T00:00:00').toLocaleDateString('es-DO'):''}

function daysBetween(a,b){if(!a||!b)return 0;return Math.max(0,Math.floor((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000))}

function diasVencidosFirmados(vencimiento,fechaCorte){if(!vencimiento||!fechaCorte)return 0;const venc=isoDate(vencimiento),corte=isoDate(fechaCorte);if(!venc||!corte)return 0;return Math.floor((corte-venc)/86400000)}

function fmtDateTime(s){return s?new Date(s).toLocaleString('es-DO',{dateStyle:'short',timeStyle:'short'}):'—'}

async function sha256(text){if(!window.crypto?.subtle)return '';const b=new TextEncoder().encode(text),h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

function bytesHuman(n){n=Number(n||0);if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(2)+' MB'}
