/* Navegación — vistas, submenú de CxP, fechas iniciales y refresco
 * Moto Repuesto Sandy — módulo extraído del monolito v18 v5.
 * Se carga como script clásico: comparte el scope global con el resto de módulos.
 */

function initDates(){['vc-fecha','cr-fecha','ri-fecha'].forEach(i=>$(i).value=previousSunday());['fx-fecha','pg-fecha','ga-fecha','pr-fecha','obp-fecha','prp-fecha','fx-corte','ec-corte','ag-corte','nom-fecha'].forEach(i=>{if($(i))$(i).value=today()});if($('fx-desde'))$('fx-desde').value='';if($('fx-hasta'))$('fx-hasta').value='';setDashPeriod();setNextWeek();if($('pr-fecha'))$('pr-fecha').value=today();togglePrestamoFases();}

function activateView(v){document.querySelectorAll('.nav button[data-v]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));const b=document.querySelector('.nav button[data-v="'+v+'"]');if(b)b.classList.add('active');const view=$('v-'+v);if(view)view.classList.add('active');refresh(v)}

function nav(){document.querySelectorAll('.nav button[data-v]').forEach(b=>{b.onclick=()=>{if(b.dataset.v==='cxp'){const sub=$('cxp-subnav'),arrow=$('cxp-arrow');const open=sub.classList.toggle('open');arrow.classList.toggle('open',open);b.setAttribute('aria-expanded',String(open));activateView('cxp');return}$('cxp-subnav')?.classList.remove('open');$('cxp-arrow')?.classList.remove('open');$('nav-cxp')?.setAttribute('aria-expanded','false');activateView(b.dataset.v)}})}

function initCxpSubnav(){
 const main=$('nav-cxp'),sub=$('cxp-subnav'),arrow=$('cxp-arrow');
 if(!main||!sub)return;
 const links=[...document.querySelectorAll('[data-cxp-target]')];
 const setActive=(id)=>{
  links.forEach(x=>x.classList.toggle('active',x.dataset.cxpTarget===id));
  document.querySelectorAll('.cxp-title-current').forEach(el=>el.classList.remove('cxp-title-current'));
  const sec=document.getElementById(id);
  if(sec){
   const title=sec.querySelector('.section-title');
   if(title) title.classList.add('cxp-title-current');
  }
 };
 const goToSection=(id)=>{
   const target=$(id); if(!target)return;
   const y=target.getBoundingClientRect().top+window.pageYOffset-18;
   window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
 };
 links.forEach(a=>a.addEventListener('click',e=>{
   e.preventDefault();
   const id=a.dataset.cxpTarget;
   if(!sub.classList.contains('open')){sub.classList.add('open');arrow.classList.add('open');main.setAttribute('aria-expanded','true');}
   if(!$('v-cxp')?.classList.contains('active')) activateView('cxp');
   setActive(id);
   requestAnimationFrame(()=>setTimeout(()=>goToSection(id),30));
 }));
 const targets=links.map(a=>$(a.dataset.cxpTarget)).filter(Boolean);
 if('IntersectionObserver' in window){
   const io=new IntersectionObserver(entries=>{
     const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
     if(visible)setActive(visible.target.id);
   },{root:null,rootMargin:'-18% 0px -62% 0px',threshold:[0,.15,.35,.6]});
   targets.forEach(t=>io.observe(t));
 }
}

function refresh(v){if(v==='dashboard')renderDashboard();if(v==='contado')renderGestion('contado');if(v==='credito')renderGestion('credito');if(v==='recibos')renderGestion('recibos');if(v==='cxp')renderCxp();if(v==='gastos')renderGastos();if(v==='nomina')renderNomina();if(v==='cronograma')renderCronograma();if(v==='mantenimiento')renderMantenimiento();if(v==='empresa')renderEmpresa()}

function printReportSection(){ }
