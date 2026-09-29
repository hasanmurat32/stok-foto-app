(()=>{
'use strict';
const KEY='stokFotoV2';
const U={main:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',worker:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',core:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core.wasm.js',lang:'https://tessdata.projectnaptha.com/4.0.0_fast'};
const LABEL={prev:'Önceki Sayım','101':'101 Gelen','251':'251 Satan','301':'301 Transfer',fire:'Fire',label:'Yeni Ürün / Etiket'};
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
let st=load(),mode='',parsed=null,raw='',worker=null,preview='';
const E={cam:$('#cameraInput'),modal:$('#scanModal'),title:$('#modalTitle'),sub:$('#modalSub'),body:$('#scanBody'),save:$('#saveScanBtn'),cancel:$('#cancelScanBtn'),close:$('#closeModalBtn'),bar:$('#progressBar'),list:$('#stockList'),empty:$('#emptyState'),search:$('#searchInput'),pc:$('#productCount'),dc:$('#diffCount'),hist:$('#historyList'),date:$('#countDateInput'),net:$('#netBadge'),off:$('#offlineStatus'),toast:$('#toast'),user:$('#userSelect'),userNames:[$('#userName1'),$('#userName2'),$('#userName3')],saveUsers:$('#saveUserNamesBtn'),fireList:$('#fireList'),fireEmpty:$('#fireEmpty'),fireKg:$('#fireKgTotal'),fireAdet:$('#fireAdetTotal'),fireValue:$('#fireValueTotal')};
function fresh(){return{version:7,settings:{countDate:'',offlineReady:false,users:['Murat','Yardımcı 1','Yardımcı 2'],activeUser:0},products:{},history:[],snapshots:[],fireLog:[]}}
function load(){
 const raw=localStorage.getItem(KEY);
 let d;
 try{d=raw?JSON.parse(raw):fresh()}catch(e){return fresh()}
 try{
   d=d&&typeof d==='object'?d:fresh();
   d.settings=d.settings||{};
   if(!Array.isArray(d.settings.users)||d.settings.users.length!==3)d.settings.users=['Murat','Yardımcı 1','Yardımcı 2'];
   d.settings.activeUser=Math.max(0,Math.min(2,Number(d.settings.activeUser)||0));
   if(!Array.isArray(d.history))d.history=[];
   if(!Array.isArray(d.snapshots))d.snapshots=[];
   d.products=d.products&&typeof d.products==='object'?d.products:{};
   Object.values(d.products).forEach(p=>{
     if(p.waste==null)p.waste=0;
     if(p.otherNet==null)p.otherNet=0;
     if(p.previousAmount==null)p.previousAmount='';
     if(p.unitPrice==null||!Number.isFinite(Number(p.unitPrice))||Number(p.unitPrice)<0)p.unitPrice=(n(p.previous)>0&&n(p.previousAmount)>0)?n(p.previousAmount)/n(p.previous):0;
     if(!p.unit)p.unit='ADET'
   });
   if(!Array.isArray(d.fireLog)){
     d.fireLog=d.history.filter(h=>h.type==='fire').map(h=>{const p=d.products[h.code]||{};return{at:h.at,user:h.user||'',code:h.code,name:h.name||p.name||'',unit:h.unit||p.unit||'ADET',qty:Math.abs(n(h.newv)-n(h.oldv)),cumulative:n(h.newv)}})
   }
   d.fireLog.forEach(x=>{const p=d.products[x.code]||{},up=Number(x.unitPrice)>0?Number(x.unitPrice):calcUnitPrice(p);if(x.unitPrice==null)x.unitPrice=up;if(x.amount==null)x.amount=n(x.qty)*up});
   d.version=7;
   return d
 }catch(e){
   // Never make an existing user's stock look empty just because a migration failed.
   if(d&&typeof d==='object'){
     d.settings=d.settings||{users:['Murat','Yardımcı 1','Yardımcı 2'],activeUser:0};
     if(!Array.isArray(d.settings.users))d.settings.users=['Murat','Yardımcı 1','Yardımcı 2'];
     d.products=d.products&&typeof d.products==='object'?d.products:{};
     d.history=Array.isArray(d.history)?d.history:[];
     d.snapshots=Array.isArray(d.snapshots)?d.snapshots:[];
     d.fireLog=Array.isArray(d.fireLog)?d.fireLog:[];
     return d
   }
   return fresh()
 }
}
function save(){localStorage.setItem(KEY,JSON.stringify(st));render()}
function activateTab(name){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));$$('.tab-panel').forEach(x=>x.classList.toggle('active',x.id==='tab-'+name))}
function finishSave(message,tab){closeM();save();if(tab)activateTab(tab);if(message)toast(message)}
function n(v){v=Number(v);return Number.isFinite(v)?v:0}
function fmtQty(v){return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:3}).format(n(v))}
function fmtTL(v){return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n(v))+' TL'}
function calcUnitPrice(p){if(p&&Number.isFinite(Number(p.unitPrice))&&Number(p.unitPrice)>0)return Number(p.unitPrice);const q=n(p&&p.previous),a=n(p&&p.previousAmount);return q>0&&a>0?a/q:0}
function normUnit(v){v=String(v||'').toUpperCase().replace(/İ/g,'I').trim();return /KG|KILO|KILOGRAM/.test(v)?'KG':'ADET'}
function code(v){return String(v||'').toUpperCase().replace(/O/g,'0').replace(/[IL]/g,'1').replace(/\D/g,'').slice(0,8)}
function exp(p){return n(p.previous)+n(p.in101)-n(p.sales251)+n(p.transfer301)-n(p.waste)+n(p.otherNet)}
function dif(p){return p.actual===''||p.actual==null?null:n(p.actual)-exp(p)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ensure(c,name,unit,overwriteName){c=code(c);if(!c)return null;const isNew=!st.products[c];if(isNew)st.products[c]={code:c,name:name||('Ürün '+c),unit:normUnit(unit),previous:0,previousAmount:'',unitPrice:0,in101:0,sales251:0,transfer301:0,waste:0,otherNet:0,actual:'',nameSource:name?'ocr':'generic'};const p=st.products[c];if(p.waste==null)p.waste=0;if(!p.unit)p.unit='ADET';const generic=!p.name||p.name==='Ürün '+c;if(name&&(isNew||generic||overwriteName||p.nameSource!=='confirmed')){p.name=name;p.nameSource=overwriteName?'confirmed':'ocr'}if(unit&&(isNew||overwriteName||!p.unit))p.unit=normUnit(unit);return p}
function toast(t){E.toast.textContent=t;E.toast.classList.add('show');setTimeout(()=>E.toast.classList.remove('show'),2200)}
function signed(v){v=n(v);return v>0?'+'+v:String(v)}
function txid(){return 'tx-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
function fireValueForProduct(p){
 let remain=Math.max(0,n(p&&p.waste)),total=0;
 const logs=(st.fireLog||[]).filter(x=>x.code===p.code).slice().reverse();
 for(const x of logs){
   if(remain<=0)break;
   const q=Math.max(0,n(x.qty));if(q<=0)continue;
   const take=Math.min(remain,q);
   const up=n(x.unitPrice)>0?n(x.unitPrice):(q>0&&n(x.amount)>0?n(x.amount)/q:calcUnitPrice(p));
   total+=take*up;remain-=take
 }
 if(remain>0)total+=remain*calcUnitPrice(p);
 return total
}
function removeMatchingFireLog(h,qty){
 const logs=st.fireLog||[];let i=-1;
 if(h.id)i=logs.findIndex(x=>x.id===h.id);
 if(i<0){
   const ht=Date.parse(h.at||'')||0;let best=Infinity;
   logs.forEach((x,j)=>{
     if(x.code!==h.code||Math.abs(n(x.qty)-qty)>.0005)return;
     const xt=Date.parse(x.at||'')||0,score=Math.abs(xt-ht);
     if(score<best){best=score;i=j}
   })
 }
 if(i>=0)logs.splice(i,1)
}
function undoFireHistory(index){
 const h=st.history[index];if(!h||h.type!=='fire')return;
 const qty=Math.abs(n(h.newv)-n(h.oldv)),p=st.products[h.code];
 if(!confirm((h.code||'Ürün')+' için '+fmtQty(qty)+' '+(h.unit||p&&p.unit||'ADET')+' fire geri alınsın mı?'))return;
 if(p)p.waste=Math.max(0,n(p.waste)-qty);
 removeMatchingFireLog(h,qty);
 st.history.splice(index,1);
 save();toast('Fire geri alındı; stok, tutar ve fark güncellendi')
}
function clearFireForCode(c){
 const p=st.products[c];if(!p)return;
 const qty=Math.max(0,n(p.waste)),value=fireValueForProduct(p);
 if(!confirm(c+' için tüm mevcut fire ('+fmtQty(qty)+' '+(p.unit||'ADET')+' · '+fmtTL(value)+') silinsin mi?'))return;
 p.waste=0;
 st.fireLog=(st.fireLog||[]).filter(x=>x.code!==c);
 st.history=st.history.filter(h=>!(h.type==='fire'&&h.code===c));
 save();toast(c+' firesi silindi; stok ve fark yeniden hesaplandı')
}
function bindSwipe(el,action){
 let sx=0,sy=0,dx=0,dy=0,active=false,pid=null;
 el.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'||e.target.closest('button,input,select,textarea,label'))return;
   sx=e.clientX;sy=e.clientY;dx=0;dy=0;active=true;pid=e.pointerId;
   el.classList.add('swiping');try{el.setPointerCapture(pid)}catch(_){}
 });
 el.addEventListener('pointermove',e=>{
   if(!active||e.pointerId!==pid)return;dx=e.clientX-sx;dy=e.clientY-sy;
   if(Math.abs(dx)>Math.abs(dy))el.style.transform='translateX('+Math.max(-92,Math.min(92,dx))+'px)'
 });
 const end=e=>{
   if(!active||e.pointerId!==pid)return;active=false;el.classList.remove('swiping');el.style.transform='';
   try{el.releasePointerCapture(pid)}catch(_){}
   if(Math.abs(dx)>=70&&Math.abs(dx)>Math.abs(dy)*1.25)action()
 };
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',e=>{active=false;el.classList.remove('swiping');el.style.transform=''})
}
function render(){
 E.date.value=st.settings.countDate||'';
 if(E.user){E.user.innerHTML=st.settings.users.map((u,i)=>'<option value="'+i+'">'+esc(u)+'</option>').join('');E.user.value=String(st.settings.activeUser)}
 E.userNames.forEach((el,i)=>{if(el&&document.activeElement!==el)el.value=st.settings.users[i]||('Kullanıcı '+(i+1))});
 E.net.textContent=navigator.onLine?'Çevrimiçi':'Çevrimdışı';E.off.textContent=st.settings.offlineReady?'Çevrimdışı OCR hazır. İlk saha gününden önce uçak modunda dene.':'İlk kurulumda internet varken Çevrimdışı OCR’ı hazırla düğmesine bas.';
 const q=(E.search.value||'').toLocaleLowerCase('tr-TR');const a=Object.values(st.products).filter(p=>(p.code+' '+p.name).toLocaleLowerCase('tr-TR').includes(q)).sort((x,y)=>x.code.localeCompare(y.code));
 E.pc.textContent=Object.keys(st.products).length;E.dc.textContent=Object.values(st.products).filter(p=>dif(p)!=null&&dif(p)!==0).length;E.empty.style.display=a.length?'none':'block';
 E.list.innerHTML=a.map(p=>{const d=dif(p),cl=d==null?'diff-wait':d===0?'diff-zero':'diff-bad',dt=d==null?'Gerçek sayım bekliyor':d===0?'Fark 0':'Fark '+signed(d),u=p.unit||'ADET';return '<article class="card stock-card" data-code="'+p.code+'"><div class="stock-top"><div><div class="stock-name">'+esc(p.name)+'</div><div class="stock-code">'+p.code+' · '+u+'</div></div><div class="expected"><strong>'+fmtQty(exp(p))+'</strong><span>'+u+' · OLMASI GEREKEN</span></div></div><div class="metrics"><div class="metric"><span>Önceki</span><b>'+fmtQty(p.previous)+' '+u+'</b></div><div class="metric"><span>101 Gelen</span><b>'+fmtQty(p.in101)+' '+u+'</b></div><div class="metric"><span>251 Satan</span><b>'+fmtQty(p.sales251)+' '+u+'</b></div><div class="metric"><span>301 Transfer</span><b>'+signed(p.transfer301)+' '+u+'</b></div><div class="metric"><span>Fire</span><b>-'+fmtQty(p.waste)+' '+u+'</b></div><div class="metric"><span>Diğer Net</span><b>'+signed(p.otherNet)+' '+u+'</b></div></div><div class="editable-row"><label>Diğer Net<input class="other-net" type="number" step="0.001" inputmode="decimal" value="'+n(p.otherNet)+'"></label><label>Gerçek Sayım<input class="actual" type="number" step="0.001" inputmode="decimal" value="'+(p.actual===''?'':p.actual)+'" placeholder="Sayım günü"></label><div class="diff-badge '+cl+'">'+dt+'</div></div><div class="stock-actions"><div><button class="small-action edit-product">Adı / Birimi Düzelt</button> <button class="small-action fire-add">+ Fire Ekle</button></div><button class="link-danger delete-product">Ürünü sil</button></div></article>'}).join('');
 $$('.other-net').forEach(x=>x.onchange=e=>{const p=st.products[e.target.closest('.stock-card').dataset.code];p.otherNet=n(e.target.value);save()});
 $$('.actual').forEach(x=>x.onchange=e=>{const p=st.products[e.target.closest('.stock-card').dataset.code];p.actual=e.target.value===''?'':n(e.target.value);save()});
 $$('.edit-product').forEach(x=>x.onclick=e=>openProductEdit(e.target.closest('.stock-card').dataset.code));
 $$('.fire-add').forEach(x=>x.onclick=e=>openWaste(e.target.closest('.stock-card').dataset.code));
 $$('.delete-product').forEach(x=>x.onclick=e=>{const c=e.target.closest('.stock-card').dataset.code;if(confirm(c+' silinsin mi?')){delete st.products[c];save()}});
 if(E.fireList){
  const fp=Object.values(st.products).filter(p=>n(p.waste)>0).sort((a,b)=>a.code.localeCompare(b.code));
  const kg=fp.filter(p=>(p.unit||'ADET')==='KG').reduce((s,p)=>s+n(p.waste),0);
  const adet=fp.filter(p=>(p.unit||'ADET')!=='KG').reduce((s,p)=>s+n(p.waste),0);
  const values={};fp.forEach(p=>values[p.code]=fireValueForProduct(p));
  const totalValue=fp.reduce((s,p)=>s+n(values[p.code]),0);
  E.fireKg.textContent=fmtQty(kg)+' KG';E.fireAdet.textContent=fmtQty(adet)+' ADET';if(E.fireValue)E.fireValue.textContent=fmtTL(totalValue);
  E.fireEmpty.style.display=fp.length?'none':'block';
  E.fireList.innerHTML=fp.map(p=>'<div class="card fire-item swipe-row fire-swipe" data-code="'+p.code+'"><div class="fire-item-main"><b>'+esc(p.name)+'</b><small>'+p.code+' · '+(p.unit||'ADET')+' · Birim fiyat '+fmtTL(calcUnitPrice(p))+' · Sağa/sola kaydır: fireyi sil</small></div><div class="fire-item-qty">-'+fmtQty(p.waste)+' '+(p.unit||'ADET')+'<br><small>'+fmtTL(values[p.code]||0)+'</small></div></div>').join('');
 }
 const hr=st.history.map((h,i)=>({h,i})).reverse();
 E.hist.innerHTML=hr.length?hr.map(x=>'<div class="card history-item'+(x.h.type==='fire'?' swipe-row fire-history':'')+'" data-history-index="'+x.i+'"><div class="history-type">'+esc(LABEL[x.h.type]||x.h.type)+'</div><div><b>'+x.h.code+'</b> '+esc(x.h.name||'')+'<br><small>'+esc(x.h.user||'Bilinmeyen')+' · '+esc(x.h.note||'')+(x.h.type==='fire'?' · Sağa/sola kaydır: geri al':'')+'</small></div></div>').join(''):'<div class="card empty">Henüz işlem geçmişi yok.</div>';
 $('.fire-history').forEach(x=>bindSwipe(x,()=>undoFireHistory(Number(x.dataset.historyIndex))));
 $('.fire-swipe').forEach(x=>bindSwipe(x,()=>clearFireForCode(x.dataset.code)));
}
function openM(t,s){E.title.textContent=t;E.sub.textContent=s||'';E.modal.classList.add('open');E.save.disabled=true;E.bar.style.width='0%'}
function closeM(){E.modal.classList.remove('open');E.body.innerHTML='';parsed=null;raw='';E.save.style.display='';E.cancel.textContent='Vazgeç';if(preview){URL.revokeObjectURL(preview);preview=''}}
async function loadOCR(){if(window.Tesseract)return;await new Promise((ok,no)=>{const s=document.createElement('script');s.src=U.main;s.onload=ok;s.onerror=()=>no(new Error('OCR kütüphanesi yüklenemedi'));document.head.appendChild(s)})}
async function getWorker(){if(worker)return worker;await loadOCR();worker=await Tesseract.createWorker('tur',1,{workerPath:U.worker,corePath:U.core,langPath:U.lang,logger:m=>{if(m.progress!=null)E.bar.style.width=Math.round(m.progress*92+5)+'%';if(m.status)E.sub.textContent=m.status}});return worker}
async function prep(file,targetWidth=1900){const b=await createImageBitmap(file),sc=Math.min(2.6,targetWidth/b.width),w=Math.round(b.width*sc),h=Math.round(b.height*sc),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(b,0,0,w,h);b.close&&b.close();const im=x.getImageData(0,0,w,h),d=im.data;for(let i=0;i<d.length;i+=4){let g=.299*d[i]+.587*d[i+1]+.114*d[i+2];g=Math.max(0,Math.min(255,(g-128)*1.35+128));d[i]=d[i+1]=d[i+2]=g}x.putImageData(im,0,0);return c}
function lines(t){return String(t||'').split(/\r?\n/).map(s=>s.replace(/[|]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean)}
function findCode(t){for(const l of lines(t)){if(/malzeme/i.test(l)&&/kod/i.test(l)){const m=l.match(/[0-9OIL]{7,8}/);if(m)return code(m[0])}}const m=String(t).match(/[0-9OIL]{7,8}/);return m?code(m[0]):''}
function parseQtyValue(v){if(v==null)return null;let s=String(v).trim().replace(/\s/g,'');if(!s)return null;const neg=s.startsWith('-');s=s.replace(/^[+\-]/,'');if(s.includes(',')){s=s.replace(/\./g,'').replace(',','.')}else{const parts=s.split('.');if(parts.length>2)s=parts.join('');}const x=Number((neg?'-':'')+s);return Number.isFinite(x)?x:null}
function quantityAfterLabel(t){
  const src=String(t||'').replace(/\s+/g,' ');
  const re=/toplam\s*m[iıİI1l]k?t[a-zçğıöşü1l]*\s*[:=]?\s*([+\-]?\s*\d+(?:[.,]\d+)?)/i;
  const m=src.match(re);
  if(m)return parseQtyValue(m[1]);
  for(const l of lines(t)){
    const s=l.toLowerCase().replace(/ı/g,'i').replace(/[1l]/g,'i');
    if(!/toplam/.test(s)||!/mik/.test(s)||/tutar/.test(s))continue;
    const a=l.match(/[+\-]?\s*\d+(?:[.,]\d+)?/g);
    if(a&&a.length)return parseQtyValue(a[a.length-1]);
  }
  return null
}
function amountAfterLabel(t){
  const src=String(t||'').replace(/\s+/g,' ');
  const re=/toplam\s*tutar\s*[:=]?\s*([+\-]?\s*\d+(?:[.,]\d+)?)/i;
  const m=src.match(re);
  if(m)return parseQtyValue(m[1]);
  for(const l of lines(t)){
    const s=normOcr(l);
    if(!/toplam/.test(s)||!/tutar/.test(s))continue;
    const a=l.match(/[+\-]?\s*\d+(?:[.,]\d+)?/g);
    if(a&&a.length)return parseQtyValue(a[a.length-1]);
  }
  return null
}
function findTotal(t){
  const q=quantityAfterLabel(t);
  if(q!=null)return q;
  for(const l of lines(t)){
    if(/toplam/i.test(l)&&/m[iıİI1l]ktar/i.test(l)&&!/tutar/i.test(l)){
      const a=l.match(/[+\-]?\s*\d+(?:[.,]\d+)?/g);
      if(a&&a.length)return parseQtyValue(a[0]);
    }
  }
  return null
}
function parseMove(t,m){const c=findCode(t),p=st.products[c],q=findTotal(t);return{kind:'move',mode:m,code:c,name:p?p.name:(c?'Ürün '+c:''),qty:q,dir:q!=null&&q<0?-1:1}}
function productCodeFromLine(l){
  const strict=l.match(/(?:ürün|urun)\s*kodu?\s*[:=]?\s*([0-9OIL]{7,8})/i);
  if(strict)return code(strict[1]);
  if(/(?:ürün|urun|malzeme)/i.test(l)&&/kod/i.test(l)){const m=l.match(/[0-9OIL]{7,8}/);if(m)return code(m[0])}
  const all=l.match(/[0-9OIL]{7,8}/g)||[];
  for(const x of all){const c=code(x);if(c.length>=7)return c}
  return ''
}
function productNameFromBlock(block,c){
  let s=String(block||'').replace(/\s+/g,' ');
  const pos=s.search(new RegExp(c.replace(/^0+/,'0*'),'i'));
  if(pos>=0)s=s.slice(pos+c.length);
  s=s.replace(/^.*?(?:a[cç][iıİI1l]klama)\s*[:=]?\s*/i,'');
  const cut=s.search(/\s+(?:birim|koli\s*[iıİI1l][cç]i|koli\s*miktar|koli\s*d[iıİI1l][sş]i|toplam\s*m[iıİI1l]ktar|toplam\s*tutar)\b/i);
  if(cut>=0)s=s.slice(0,cut);
  return s.replace(/^[\-:]+|[\-:]+$/g,'').trim()
}
function unitFromBlock(block){const s=String(block||'').toUpperCase();const m=s.match(/B[IİI1L]R[IİI1L]M\s*[:=]?\s*(KG|KGR|KILO(?:GRAM)?|ADET|ADT)\b/);if(m)return normUnit(m[1]);if(/\b(KG|KGR|KILO(?:GRAM)?)\b/.test(s))return 'KG';if(/\b(ADET|ADT)\b/.test(s))return 'ADET';return 'ADET'}
function labelCode(t){
 for(const l of lines(t)){if(/(?:ürün|urun|malzeme)/i.test(l)&&/kod/i.test(l)){const m=l.match(/(?:^|\D)([0-9OIL]{7,8})(?!\d)/);if(m)return code(m[1])}}
 const m=String(t||'').match(/(?:^|\D)([0-9OIL]{7,8})(?!\d)/);return m?code(m[1]):''
}
function labelName(t,c){
 const bad=/(?:barkod|barcode|fiyat|price|ürün\s*kod|urun\s*kod|malzeme\s*kod|toplam|tutar|birim|kdv|tl\b|₺|f\.?d\.?tarihi|tarih|yerli\s*üretim|yerli\s*uretim|üretim|uretim|qr)/i;
 const out=[];
 for(const rawLine of lines(t)){
   let x=rawLine.replace(c,'').replace(/(?:ürün\s*adı|urun\s*adi|açıklama|aciklama)\s*[:=]?/ig,'').trim();
   if(!x||bad.test(x))continue;
   if(/\b\d{7,8}\b/.test(x)||/^\d{3,5}$/.test(x))continue;
   if(/^\d+[.,]?\d*\s*(?:₺|TL)$/i.test(x))continue;
   const qty=/^\d+(?:[.,]\d+)?\s*(?:G|GR|KG|ML|L)$/i.test(x);
   const letters=(x.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g)||[]).length;
   if(letters>=4||qty)out.push(x);
   if(out.length>=5)break;
 }
 return out.join(' ').replace(/\s+/g,' ').trim()
}
function parseLabel(t){const c=labelCode(t);return{kind:'label',code:c,name:labelName(t,c),unit:unitFromBlock(t)}}
function normOcr(s){return String(s||'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/[1l|]/g,'i').replace(/[^a-z0-9çğıöşü+\-.,:% ]/g,' ').replace(/\s+/g,' ').trim()}
function flattenOcrLines(blocks){
 const out=[];
 (blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>{if(l&&l.text&&l.bbox)out.push({text:l.text.replace(/\s+/g,' ').trim(),bbox:l.bbox})})));
 return out.filter(x=>x.text).sort((a,b)=>(a.bbox.y0-b.bbox.y0)||(a.bbox.x0-b.bbox.x0))
}
function codeFromAnyLine(s){
 const arr=String(s||'').match(/[0-9OIL]{7,8}/gi)||[];
 for(const x of arr){const cc=code(x);if(cc.length>=7)return cc}
 return ''
}
function qtyFromStructuredLine(s){
 const raw=String(s||''),nrm=normOcr(raw);
 if(!/toplam/.test(nrm)||!/mik/.test(nrm)||/tutar/.test(nrm))return null;
 const mi=nrm.indexOf('mik'),tail=mi>=0?raw.slice(Math.max(0,mi-2)):raw;
 const nums=tail.match(/[+\-]?\s*\d+(?:[.,]\d+)?/g);
 if(!nums||!nums.length)return null;
 return parseQtyValue(nums[0])
}
function amountFromStructuredLine(s){
 const raw=String(s||''),nrm=normOcr(raw);
 if(!/toplam/.test(nrm)||!/tutar/.test(nrm))return null;
 const nums=raw.match(/[+\-]?\s*\d+(?:[.,]\d+)?/g);
 if(!nums||!nums.length)return null;
 return parseQtyValue(nums[nums.length-1])
}
function nameFromStructuredBand(lines,c){
 for(const l of lines){
   const n=normOcr(l.text);
   if(/aciklama|açiklama|açıklama/.test(n)){
     let s=l.text.replace(/^.*?(?:a[cç][iıİI1l]klama)\s*[:=]?\s*/i,'').trim();
     s=s.replace(/\s+(?:birim|toplam\s*m[iıİI1l]k\w*|toplam\s*tutar).*$/i,'').trim();
     if(s.length>=3)return s
   }
 }
 return productNameFromBlock(lines.map(x=>x.text).join(' '),c)
}
function parsePrevStructured(text,blocks){
 const L=flattenOcrLines(blocks);
 if(!L.length)return parsePrev(text);
 const starts=[];
 for(let i=0;i<L.length;i++){const cc=productCodeFromLine(L[i].text)||codeFromAnyLine(L[i].text);if(cc.length>=7)starts.push({i,c:cc,y:L[i].bbox.y0})}
 if(!starts.length)return parsePrev(text);
 const rows=[];
 for(let k=0;k<starts.length;k++){
   const cur=starts[k],next=starts[k+1];
   const y0=k===0?Math.max(0,cur.y-12):Math.floor((starts[k-1].y+cur.y)/2);
   const y1=next?Math.floor((cur.y+next.y)/2):cur.y+Math.max(60,(k?cur.y-starts[k-1].y:80));
   const band=L.filter(x=>{const cy=(x.bbox.y0+x.bbox.y1)/2;return cy>=y0&&cy<y1});
   let q=null,amount=null;
   for(const l of band){if(q==null)q=qtyFromStructuredLine(l.text);if(amount==null)amount=amountFromStructuredLine(l.text)}
   const joined=band.map(x=>x.text).join(' ');
   if(q==null)q=quantityAfterLabel(joined);
   if(amount==null)amount=amountAfterLabel(joined);
   if(q==null)continue;
   const name=nameFromStructuredBand(band,cur.c)||('Ürün '+cur.c);
   rows.push({code:cur.c,name,qty:q,amount:amount==null?'':amount,unit:unitFromBlock(joined)})
 }
 const M=new Map();rows.forEach(r=>M.set(r.code,r));
 const parsed={kind:'prev',rows:Array.from(M.values())};
 return parsed.rows.length?parsed:parsePrev(text)
}
function parsePrev(t){
  const L=lines(t),starts=[];
  for(let i=0;i<L.length;i++){const c=productCodeFromLine(L[i]);if(c.length>=7)starts.push({i,c})}
  const rows=[];
  for(let k=0;k<starts.length;k++){
    const cur=starts[k],end=k+1<starts.length?starts[k+1].i:Math.min(L.length,cur.i+5);
    const block=L.slice(cur.i,end).join(' ');
    const q=quantityAfterLabel(block),amount=amountAfterLabel(block);
    if(q==null)continue;
    const name=productNameFromBlock(block,cur.c)||('Ürün '+cur.c);
    rows.push({code:cur.c,name,qty:q,amount:amount==null?'':amount,unit:unitFromBlock(block)})
  }
  const M=new Map();rows.forEach(r=>M.set(r.code,r));
  return{kind:'prev',rows:Array.from(M.values())}
}
function rotateCanvas(src,deg){
 const r=((deg%360)+360)%360,c=document.createElement('canvas'),swap=r===90||r===270;
 c.width=swap?src.height:src.width;c.height=swap?src.width:src.height;
 const x=c.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(r*Math.PI/180);x.drawImage(src,-src.width/2,-src.height/2);return c
}
function labelScore(t){
 const p=parseLabel(t);let s=0;
 if(p.code&&p.code.length>=7)s+=100;
 if(p.name){s+=Math.min(50,p.name.length);if(/\b(?:G|GR|KG|ML|L)\b/i.test(p.name))s+=8}
 const L=lines(t);s+=Math.min(20,L.filter(x=>/[A-Za-zÇĞİÖŞÜçğıöşü]{4}/.test(x)).length*4);
 return s
}
async function recognizeLabelBest(base,w){
 const tries=[0,90,270],out=[];
 for(const deg of tries){
   E.sub.textContent='Etiket yönü kontrol ediliyor · '+deg+'°';
   const r=await w.recognize(deg?rotateCanvas(base,deg):base),t=r.data.text||'';
   out.push({deg,t,score:labelScore(t)});
   if(labelScore(t)>=125)break
 }
 let best=out.sort((a,b)=>b.score-a.score)[0]||{t:''};
 if(best.score<100){
   E.sub.textContent='Etiket yönü kontrol ediliyor · 180°';
   const r=await w.recognize(rotateCanvas(base,180)),t=r.data.text||'',x={deg:180,t,score:labelScore(t)};
   if(x.score>best.score)best=x
 }
 return best.t
}
async function scan(file){openM(LABEL[mode]+' fotoğrafı','Fotoğraf okunuyor…');preview=URL.createObjectURL(file);E.body.innerHTML='<img class="preview" src="'+preview+'"><div class="status-box">OCR hazırlanıyor…</div>';try{const target=mode==='prev'?2500:(mode==='label'?2200:1900),c=await prep(file,target),w=await getWorker();if(mode==='label'){raw=await recognizeLabelBest(c,w);parsed=parseLabel(raw)}else if(mode==='prev'){E.sub.textContent='Önceki sayım satırları ayrıştırılıyor…';const r=await w.recognize(c,{}, {text:true,blocks:true});raw=r.data.text||'';parsed=parsePrevStructured(raw,r.data.blocks||[])}else{const r=await w.recognize(c);raw=r.data.text||'';parsed=parseMove(raw,mode)}E.bar.style.width='100%';confirmUI()}catch(e){E.body.innerHTML+='<div class="status-box" style="color:#992c2c">Okuma başarısız: '+esc(e.message||e)+'</div>'}}
function confirmUI(){
 E.sub.textContent='Okunan bilgileri kontrol et; gerekirse düzelt.';
 if(parsed.kind==='label'){
  E.body.innerHTML='<img class="preview" src="'+preview+'"><div class="confirm-grid"><div class="field"><label>Ürün Kodu</label><input id="lc" value="'+esc(parsed.code||'')+'" inputmode="numeric" placeholder="7-8 haneli ürün kodu"></div><div class="field"><label>Ürün Adı</label><input id="ln" value="'+esc(parsed.name||'')+'" placeholder="Ürün adı"></div><div class="field"><label>Birim</label><select id="lu"><option value="ADET">ADET</option><option value="KG">KG</option></select></div><div class="status-box">Bu ürün önceki sayımda yoksa <b>Önceki = 0</b> ile kaydolur. Daha sonra 101 / 251 / 301 / Fire verilerini girdiğinde doğrudan aynı ürüne işlenir.</div></div><details class="raw"><summary>OCR ham metni</summary><pre>'+esc(raw)+'</pre></details>';
  $('#lu').value=parsed.unit||'ADET';const valid=()=>{E.save.disabled=code($('#lc').value).length<7||!$('#ln').value.trim()};$('#lc').oninput=valid;$('#ln').oninput=valid;valid();return
 }
 if(parsed.kind==='prev'){
  const none=!parsed.rows.length;
  E.body.innerHTML='<img class="preview" src="'+preview+'">'+(none?'<div class="status-box" style="color:#8a4f19"><b>OCR tamamlandı ama ürün satırı bulunamadı.</b><br>Fotoğrafı yeniden çekebilir veya satırı elle ekleyebilirsin.</div><button id="retryPrev" class="primary" style="margin-bottom:8px">Fotoğrafı Yeniden Çek</button>':'')+'<div class="prev-grid-head"><span>Kod</span><span>Ürün</span><span>Miktar</span><span>Tutar TL</span><span></span></div><div id="prevRows" class="confirm-grid">'+parsed.rows.map((r,i)=>'<div class="confirm-row" data-i="'+i+'"><input class="code-input" value="'+r.code+'" inputmode="numeric"><input class="name-input" value="'+esc(r.name)+' ('+esc(r.unit||'ADET')+')"><input class="qty-input" type="number" step="0.001" value="'+r.qty+'" inputmode="decimal"><input class="amount-input" type="number" step="0.01" value="'+(r.amount===''?'':r.amount)+'" inputmode="decimal" placeholder="TL"><button class="remove-row">✕</button></div>').join('')+'</div><button id="addPrevRow" class="secondary" style="margin-top:8px">+ Elle satır ekle</button><details class="raw"><summary>OCR ham metni</summary><pre>'+esc(raw)+'</pre></details>';
  bindPrev();
  if($('#retryPrev'))$('#retryPrev').onclick=()=>{closeM();mode='prev';E.cam.value='';E.cam.click()};
  $('#addPrevRow').onclick=()=>{parsed.rows.push({code:'',name:'',qty:0,amount:'',unit:'ADET'});confirmUI()};
  E.save.disabled=!parsed.rows.length;return
}
 E.body.innerHTML='<img class="preview" src="'+preview+'"><div class="confirm-grid"><div class="field"><label>Ürün Kodu</label><input id="mc" value="'+esc(parsed.code)+'" inputmode="numeric"></div><div class="field"><label>Ürün Adı</label><input id="mn" value="'+esc(parsed.name)+'"></div><div class="field"><label>Toplam Miktar</label><input id="mq" type="number" inputmode="numeric" value="'+(parsed.qty==null?'':Math.abs(parsed.qty))+'"></div>'+(parsed.mode==='301'?'<div class="field"><label>301 yönü</label><div class="direction"><button id="dp" class="'+(parsed.dir>0?'active':'')+'">+ Bize gelen</button><button id="dm" class="'+(parsed.dir<0?'active':'')+'">− Bizden giden</button></div></div>':'')+'<details class="raw"><summary>OCR ham metni</summary><pre>'+esc(raw)+'</pre></details></div>';const val=()=>E.save.disabled=!(code($('#mc').value).length>=7&&$('#mq').value!=='');$('#mc').oninput=val;$('#mq').oninput=val;if(parsed.mode==='301'){$('#dp').onclick=()=>{parsed.dir=1;confirmUI()};$('#dm').onclick=()=>{parsed.dir=-1;confirmUI()}}val()
}
function bindPrev(){$$('#prevRows .confirm-row').forEach(row=>{const i=Number(row.dataset.i),r=parsed.rows[i];row.querySelector('.code-input').oninput=e=>r.code=code(e.target.value);row.querySelector('.name-input').oninput=e=>{const v=e.target.value;r.name=v.replace(/\s*\((ADET|KG)\)\s*$/i,'').trim()};row.querySelector('.qty-input').oninput=e=>r.qty=Number(e.target.value);row.querySelector('.amount-input').oninput=e=>r.amount=e.target.value===''?'':Number(e.target.value);row.querySelector('.remove-row').onclick=()=>{parsed.rows.splice(i,1);confirmUI()}})}
function hist(type,p,field,oldv,newv,note,id){const user=st.settings.users[st.settings.activeUser]||'Kullanıcı',h={id:id||txid(),at:new Date().toISOString(),user,type,code:p.code,name:p.name,unit:p.unit||'ADET',field,oldv,newv,note};st.history.push(h);if(st.history.length>1000)st.history=st.history.slice(-1000);return h}
function openProductEdit(c){
 const p=st.products[c];if(!p)return;
 openM('Ürün Bilgisini Düzelt','Ürün kodu sabit kalır; adı ve birimi burada doğrulayabilirsin.');
 E.bar.style.width='100%';parsed={kind:'editProduct',code:c};
 E.body.innerHTML='<div class="confirm-grid"><div class="field"><label>Ürün Kodu</label><input value="'+esc(p.code)+'" disabled></div><div class="field"><label>Ürün Adı</label><input id="editProductName" value="'+esc(p.name)+'"></div><div class="field"><label>Birim</label><select id="editProductUnit"><option value="ADET">ADET</option><option value="KG">KG</option></select></div><div class="status-box">Bir kez düzelttiğin ürün adı, sonraki Önceki Sayım / 101 / 251 / 301 OCR okumalarında artık otomatik olarak bozulmaz.</div></div>';
 $('#editProductUnit').value=p.unit||'ADET';
 const valid=()=>E.save.disabled=!$('#editProductName').value.trim();$('#editProductName').oninput=valid;valid()
}
function openWaste(prefill){
 openM('Fire Girişi','Kaydedince pencere otomatik kapanır. Stokta olmayan ürün de Önceki = 0 ile oluşturulabilir.');
 E.bar.style.width='100%';
 parsed={kind:'fire'};
 const codes=Object.values(st.products).sort((a,b)=>a.code.localeCompare(b.code));
 E.body.innerHTML='<div class="confirm-grid"><div class="field"><label>Ürün Kodu</label><input id="fireCode" list="fireProducts" inputmode="numeric" value="'+esc(prefill||'')+'" placeholder="Örn. 0200367"><datalist id="fireProducts">'+codes.map(p=>'<option value="'+p.code+'">'+esc(p.name)+'</option>').join('')+'</datalist></div><div class="field"><label>Ürün Adı</label><input id="fireName" placeholder="Stokta yoksa isteğe bağlı ürün adı"></div><div id="fireProductInfo" class="status-box">Ürün kodunu seç veya yaz.</div><div class="field"><label>Birim</label><select id="fireUnit"><option value="ADET">ADET</option><option value="KG">KG</option></select></div><div class="field"><label>Birim Fiyat (TL)</label><input id="fireUnitPrice" type="text" inputmode="decimal" placeholder="Önceki sayımdan otomatik gelir"></div><div class="field"><label>Fire Miktarı</label><input id="fireQty" type="text" inputmode="decimal" placeholder="Örn. 2 veya 0,500"></div><div id="firePreview" class="status-box">Miktarı girince fire tutarı hesaplanır.</div></div>';
 const refresh=()=>{
   const fc=code($('#fireCode').value),p=st.products[fc],q0=parseQtyValue($('#fireQty').value),q=q0==null?NaN:Math.abs(q0);
   if(p){
     if(document.activeElement!==$('#fireName'))$('#fireName').value=p.name||'';
     if(document.activeElement!==$('#fireUnit'))$('#fireUnit').value=p.unit||'ADET';
     const auto=calcUnitPrice(p);
     if(document.activeElement!==$('#fireUnitPrice')&&!$('#fireUnitPrice').value&&auto>0)$('#fireUnitPrice').value=String(Number(auto.toFixed(4)));
     const up0=parseQtyValue($('#fireUnitPrice').value),up=up0==null?0:Math.abs(up0),u=$('#fireUnit').value,value=Number.isFinite(q)&&q>0?q*up:0;
     $('#fireProductInfo').innerHTML='<b>'+esc(p.name)+'</b><br>'+p.code+' · Birim: '+u+' · Mevcut fire: '+fmtQty(p.waste)+' '+u+(auto>0?' · Kayıtlı fiyat: '+fmtTL(auto):'');
     $('#firePreview').textContent=Number.isFinite(q)&&q>0?'Eklenecek fire: '+fmtQty(q)+' '+u+' · Fire tutarı: '+fmtTL(value)+' · Yeni fire toplamı: '+fmtQty(n(p.waste)+q)+' '+u:'Fire miktarını gir.';
     E.save.disabled=!(Number.isFinite(q)&&q>0&&up>0)
   }else{
     const validCode=fc.length>=7,up0=parseQtyValue($('#fireUnitPrice').value),up=up0==null?0:Math.abs(up0),u=$('#fireUnit').value,value=Number.isFinite(q)&&q>0?q*up:0;
     $('#fireProductInfo').innerHTML=validCode?'<b>Yeni ürün olarak kaydedilecek.</b><br>'+fc+' · Önceki = 0 · Birim: '+u:'Ürün kodunu seç veya yaz.';
     $('#firePreview').textContent=validCode&&Number.isFinite(q)&&q>0?'Fire: '+fmtQty(q)+' '+u+' · Tutar: '+fmtTL(value)+' · Kaydedince ürün stok listesine de eklenir.':'Kod, birim fiyat ve fire miktarını gir.';
     E.save.disabled=!(validCode&&Number.isFinite(q)&&q>0&&up>0)
   }
 };
 $('#fireCode').oninput=()=>{$('#fireUnitPrice').value='';refresh()};$('#fireName').oninput=refresh;$('#fireQty').oninput=refresh;$('#fireUnitPrice').oninput=refresh;$('#fireUnit').onchange=refresh;refresh()
}
function saveScan(){
 if(parsed&&parsed.kind==='editProduct'){
   const p=st.products[parsed.code],name=$('#editProductName').value.trim(),unit=normUnit($('#editProductUnit').value);
   if(!p||!name){toast('Ürün adı gerekli');return}
   const oldName=p.name,oldUnit=p.unit||'ADET';p.name=name;p.unit=unit;p.nameSource='confirmed';
   hist('label',p,'product',oldName+' / '+oldUnit,name+' / '+unit,'Ürün adı/birimi elle doğrulandı');
   finishSave(p.code+' ürün bilgisi düzeltildi');return
 }
 if(parsed&&parsed.kind==='label'){
   const lc=code($('#lc').value),name=$('#ln').value.trim(),unit=normUnit($('#lu').value);
   if(lc.length<7||!name){toast('Ürün kodu ve adı gerekli');return}
   const existed=!!st.products[lc],p=ensure(lc,name,unit,true);p.nameSource='confirmed';
   hist('label',p,'product',existed?'mevcut':'yeni','kayıt',existed?'Etiket bilgisi doğrulandı':'Yeni ürün etiketten kaydedildi · Önceki 0');
   finishSave(lc+(existed?' adı doğrulandı':' yeni ürün kaydedildi'));return
 }
 if(parsed&&parsed.kind==='fire'){
   const fc=code($('#fireCode').value),name=$('#fireName').value.trim(),q0=parseQtyValue($('#fireQty').value),up0=parseQtyValue($('#fireUnitPrice').value),q=q0==null?NaN:Math.abs(q0),up=up0==null?0:Math.abs(up0),unit=normUnit($('#fireUnit').value);
   if(fc.length<7){toast('Geçerli ürün kodu gir');return}
   if(!Number.isFinite(q)||q<=0){toast('Fire miktarını kontrol et');return}
   if(up<=0){toast('Birim fiyatı kontrol et');return}
   const existed=!!st.products[fc],p=ensure(fc,name,unit,false);p.unit=unit;p.unitPrice=up;
   if(name&&(!existed||p.nameSource!=='confirmed'))p.name=name;
   const amount=q*up,old=n(p.waste);p.waste=old+q;
   const at=new Date().toISOString(),user=st.settings.users[st.settings.activeUser]||'Kullanıcı',id=txid();
   st.fireLog.push({id,at,user,code:p.code,name:p.name,unit:p.unit,qty:q,unitPrice:up,amount,cumulative:p.waste});
   hist('fire',p,'waste',old,p.waste,'Fire +'+fmtQty(q)+' '+p.unit+' · '+fmtTL(amount)+(existed?'':' · yeni ürün'),id);
   finishSave(p.code+' fire kaydedildi · '+fmtTL(amount),'fire');return
 }
 if(parsed.kind==='prev'){
   let k=0;
   parsed.rows.forEach(r=>{const c=code(r.code),q=Number(r.qty);if(c.length<7||!Number.isFinite(q))return;const p=ensure(c,r.name,r.unit,false),o=p.previous;p.previous=q;p.previousAmount=r.amount===''?'':n(r.amount);if(q>0&&p.previousAmount!=='')p.unitPrice=n(p.previousAmount)/q;hist('prev',p,'previous',o,q,'Önceki sayım '+q+(p.previousAmount!==''?' · Tutar '+p.previousAmount+' TL':''));k++});
   if(!k){toast('Kaydedilecek geçerli satır yok');return}
   finishSave(k+' ürün kaydedildi');return
 }
 const c=code($('#mc').value),name=$('#mn').value.trim(),q=Math.abs(Number($('#mq').value)),p=ensure(c,name,null,false);
 if(!p||!Number.isFinite(q)){toast('Ürün kodu veya miktarı kontrol et');return}
 let f='',v=q;if(parsed.mode==='101')f='in101';if(parsed.mode==='251')f='sales251';if(parsed.mode==='301'){f='transfer301';v=q*(parsed.dir||1)}
 const o=p[f];p[f]=v;hist(parsed.mode,p,f,o,v,LABEL[parsed.mode]+' '+signed(v));
 finishSave(c+' güncellendi · olması gereken '+fmtQty(exp(p))+' '+(p.unit||'ADET'))
}
function currentSnapshot(){
 const at=new Date().toISOString(),user=st.settings.users[st.settings.activeUser]||'Kullanıcı';
 const rows=Object.values(st.products).sort((a,b)=>a.code.localeCompare(b.code)).map(p=>({code:p.code,name:p.name,unit:p.unit||'ADET',previous:n(p.previous),previousAmount:p.previousAmount===''?'':n(p.previousAmount),unitPrice:calcUnitPrice(p),in101:n(p.in101),sales251:n(p.sales251),transfer301:n(p.transfer301),waste:n(p.waste),otherNet:n(p.otherNet),expected:exp(p),actual:p.actual===''?'':n(p.actual),diff:dif(p)==null?'':dif(p)}));
 return{at,user,rows}
}
function cumulativeCsv(){
 const rows=[['Yedek Tarihi','Kullanıcı','Ürün Kodu','Ürün Adı','Birim','Önceki Sayım','Önceki Tutar TL','Birim Fiyat TL','101 Gelen','251 Satan','301 Transfer','Fire','Diğer Net','Olması Gereken','Gerçek Sayım','Fark']];
 st.snapshots.forEach(s=>(s.rows||[]).forEach(p=>rows.push([s.at,s.user||'',p.code,p.name,p.unit||'ADET',p.previous,p.previousAmount,p.unitPrice,p.in101,p.sales251,p.transfer301,p.waste,p.otherNet,p.expected,p.actual,p.diff])));
 return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';')).join('\r\n')
}
function appendExcelBackup(){
 st.snapshots.push(currentSnapshot());
 if(st.snapshots.length>120)st.snapshots=st.snapshots.slice(-120);
 localStorage.setItem(KEY,JSON.stringify(st));
 const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
 dl(cumulativeCsv(),'stok-yedek-birikimli-'+stamp+'.csv','text/csv;charset=utf-8');
 render();toast('Excel yedeğine yeni kayıt eklendi · toplam '+st.snapshots.length+' yedek')
}
function fireCsv(){
 const rows=[['Tarih','Kullanıcı','Ürün Kodu','Ürün Adı','Birim','Fire Girişi','Birim Fiyat TL','Fire Tutarı TL','Ürün Toplam Fire']];
 (st.fireLog||[]).forEach(x=>rows.push([x.at,x.user||'',x.code,x.name||'',x.unit||'ADET',x.qty,x.unitPrice||0,x.amount||0,x.cumulative]));
 rows.push(['','','','','','','','TOPLAM', (st.fireLog||[]).reduce((s,x)=>s+n(x.amount),0)]);
 return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(';')).join('\r\n')
}
function exportFire(){const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);dl(fireCsv(),'fire-raporu-'+stamp+'.csv','text/csv;charset=utf-8');toast('Fire raporu indirildi')}
function dl(data,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:type||'application/octet-stream'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function offline(){const b=$('#offlinePrepBtn');b.disabled=true;openM('Çevrimdışı OCR hazırlanıyor','İlk kez internet gerekir.');E.save.style.display='none';E.cancel.textContent='Kapat';E.body.innerHTML='<div class="status-box">OCR motoru ve Türkçe model indiriliyor…</div>';try{const w=await getWorker(),c=document.createElement('canvas');c.width=300;c.height=80;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,80);x.fillStyle='#000';x.font='30px Arial';x.fillText('0200367 160',10,50);await w.recognize(c);st.settings.offlineReady=true;save();E.body.innerHTML='<div class="status-box" style="color:#116236"><b>Hazır.</b> Çevrimdışı OCR kurulumu tamamlandı. Bu pencereyi kapatabilirsin.</div>'}catch(e){E.body.innerHTML='<div class="status-box" style="color:#992c2c">Hazırlama başarısız: '+esc(e.message||e)+'</div>'}finally{b.disabled=false}}
$$('.scan-btn[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;E.cam.value='';E.cam.click()});$('#wasteEntryBtn').onclick=()=>openWaste('');E.cam.onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)scan(f)};E.save.onclick=saveScan;E.cancel.onclick=closeM;E.close.onclick=closeM;E.search.oninput=render;E.date.onchange=()=>{st.settings.countDate=E.date.value;save()};if(E.user)E.user.onchange=()=>{st.settings.activeUser=Number(E.user.value)||0;save()};E.userNames.forEach((el,i)=>{if(el)el.onchange=()=>{const v=el.value.trim()||('Kullanıcı '+(i+1));st.settings.users[i]=v;save()}});if(E.saveUsers)E.saveUsers.onclick=()=>{E.userNames.forEach((el,i)=>{const v=(el&&el.value.trim())||('Kullanıcı '+(i+1));st.settings.users[i]=v});save();toast('Kullanıcı isimleri kaydedildi')};
$$('.tab').forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));
$('#offlinePrepBtn').onclick=offline;$('#loadDemoBtn').onclick=()=>{const p=ensure('0200367','YOĞURT %4 YAĞLI 3000 G DOST','ADET',true);p.nameSource='confirmed';Object.assign(p,{unit:'ADET',previous:16,previousAmount:0,unitPrice:0,in101:160,sales251:149,transfer301:3,waste:0,otherNet:0,actual:''});save();toast('Yoğurt örneği: 30 adet')};
$('#clearAllBtn').onclick=()=>{if(confirm('Tüm stok verisi silinsin mi?')){st=fresh();save()}};$('#clearHistoryBtn').onclick=()=>{if(confirm('Bu işlem yalnız geçmiş listesini temizler; stok, fire ve tutar hesaplarını değiştirmez. Liste temizlensin mi?')){st.history=[];save();toast('Geçmiş listesi temizlendi')}};
$('#exportXlsxBtn').onclick=appendExcelBackup;$('#exportFireBtn').onclick=exportFire;
$('#exportBackupBtn').onclick=()=>dl(JSON.stringify(st,null,2),'stok-foto-yedek.json','application/json');$('#importBackupInput').onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.products)throw Error('Geçersiz yedek');st=d;save();toast('Yedek geri yüklendi')}catch(x){alert(x.message)}};
function bootRender(){
 try{render()}catch(e){console.error('Stok Foto render error',e)}
}
window.addEventListener('online',bootRender);
window.addEventListener('offline',bootRender);
window.addEventListener('pageshow',bootRender);
window.addEventListener('focus',bootRender);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)bootRender()});
if('serviceWorker'in navigator){
 navigator.serviceWorker.register('./sw.js').then(r=>r.update().catch(()=>{})).catch(()=>{});
}
bootRender();
setTimeout(bootRender,250);
setTimeout(bootRender,1200);
})();