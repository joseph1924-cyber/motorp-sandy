/* Series — numeración de comprobantes GO, PPR y CQP
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function code(prefix,arr){db.seriales=db.seriales||{};const maxExisting=(arr||[]).reduce((m,x)=>{const mth=String(x?.codigo||'').match(new RegExp('^'+prefix+'-(\\d+)$'));return mth?Math.max(m,Number(mth[1])):m},0);const last=Math.max(Number(db.seriales[prefix]||0),maxExisting);const next=last+1;db.seriales[prefix]=next;return prefix+'-'+String(next).padStart(5,'0');}

function pagoPrestamoActivo(x){return !!x && x.estado!=='Anulado';}

function reestablecerSecuenciaGO(){
  db.gastos=Array.isArray(db.gastos)?db.gastos:[];
  db.seriales=db.seriales||{};
  // Corrección única de la numeración GO: cierra los huecos que quedaron
  // cuando la versión anterior eliminaba comprobantes físicamente.
  if(db.seriales.GO_reestablecida===true)return false;
  const lista=[...db.gastos].sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||''))||String(a.id||'').localeCompare(String(b.id||'')));
  let changed=false;
  lista.forEach((g,i)=>{
    const nuevo=`GO-${String(i+1).padStart(5,'0')}`;
    if(g.codigo!==nuevo){g.codigo=nuevo;changed=true;}
  });
  db.seriales.GO=lista.length;
  db.seriales.GO_reestablecida=true;
  if(changed)saveWithoutDrive();
  return changed;
}

function reajustarSecuenciaPPR(){
  db.pagosPrestamos=(db.pagosPrestamos||[]);
  const pagos=[...db.pagosPrestamos].sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||''))||String(a.id||'').localeCompare(String(b.id||'')));
  let necesita=false;
  pagos.forEach((x,i)=>{if(x.codigo!==`PPR-${String(i+1).padStart(5,'0')}`)necesita=true;});
  if(!necesita){db.seriales.PPR=pagos.length;return false;}
  pagos.forEach((x,i)=>{x.codigo=`PPR-${String(i+1).padStart(5,'0')}`;if(!x.estado)x.estado='Activo';});
  db.seriales.PPR=pagos.length;
  saveWithoutDrive();
  return true;
}
