/* Belgardin grimoire — page UI: reference tables, gimmick timelines with media viewer, attack lists, calculators, rewards. */
(function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const store={get(k,d){try{const v=localStorage.getItem('belg_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('belg_'+k,JSON.stringify(v))}catch(e){}}};
const LOC=()=>window.LOCALE?window.LOCALE():'ru-RU',LG=()=>window.LANG||'ru';
const fmt=(n,d=0)=>Number(n).toLocaleString(LOC(),{maximumFractionDigits:d,minimumFractionDigits:d});
function big(n){const a=Math.abs(n),L=LG();
  if(L=='zh'){if(a>=1e12)return fmt(n/1e12,2)+' 万亿';if(a>=1e8)return fmt(n/1e8,a>=1e10?0:1)+' 亿';if(a>=1e4)return fmt(n/1e4,0)+' 万';return fmt(n,0);}
  const U=L=='en'?[' T',' B',' M']:[' трлн',' млрд',' млн'];
  if(a>=1e12)return fmt(n/1e12,2)+U[0];if(a>=1e9)return fmt(n/1e9,2)+U[1];if(a>=1e6)return fmt(n/1e6,0)+U[2];return fmt(n,0);}
/* difficulty names in the current language */
const DNL=()=>LG()=='zh'?{N:'普通',H:'困难',NM:'噩梦'}:DN;
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* in-game clips from the Inven attack guides: key → number of img/screens/<key>-N.mp4/.jpg */
const SHOTS={agg4:2,aggro5:4,backstep:2,barrage:3,blades:2,bomb4:2,burst3:2,butterfly:2,chakram:4,closegrab:2,coffinA:1,coffinB:1,coffinstag:5,cones2:1,donutlaser:4,dslam:2,five:1,flurry:1,frontback:2,frontjg:3,grind:3,halfmoon:1,holdjg:3,imprison:3,inhale:3,insightbare:4,insightblade:6,jumprope:1,kaisa:1,lattice2:2,launch:2,leap:1,medusa:2,mirror:4,nightrea:2,onetwox:2,openingjg:3,orbjg:4,orbslam:2,pacing:4,pizza:2,range:6,rearrapid:2,rise:4,rotate:3,sling:5,suddenjg:1,swirl:2,triangle:2,vanish:2,wall:3,windmill:1};
window.SHOTS=SHOTS;
const shotList=k=>Array.from({length:SHOTS[k]||0},(_,i)=>({v:`img/screens/${k}-${i+1}.mp4`,p:`img/screens/${k}-${i+1}.jpg`}));
function shotsHTML(k){const L=shotList(k);if(!L.length)return '';return `<div class="shots">${L.map((s,i)=>`<figure class="shot" data-clip="${s.v}"><video data-src="${s.v}" poster="${s.p}" muted loop playsinline preload="none"></video><b>${i+1}/${L.length}</b></figure>`).join('')}</div>`;}
const posterOf=m=>m.v?m.v.replace(/\.mp4$/,'.jpg'):m.i?m.i:'img/gimmicks/yt-g1.jpg';
const ytUrl=m=>`https://www.youtube.com/watch?v=${m.yt}&t=${m.t}s`;
/* media for the 3D compare panel: attack clips or the gimmick clips that belong to a sim */
window.mediaForSim=function(key){const L=shotList(key).map(s=>s.v);[TL1,TL2].forEach(tl=>tl.forEach(x=>{if(x.sim==key&&x.m)x.m.forEach(m=>{if(m.v&&!L.includes(m.v))L.push(m.v);});}));return L;};

/* ================= lightbox ================= */
const lb=$('#lb'),lbBody=lb.querySelector('.lb-body');
function openLB(html){lbBody.innerHTML=html;lb.hidden=false;const v=lbBody.querySelector('video');if(v)v.play().catch(()=>{});}
function closeLB(){lbBody.querySelectorAll('video').forEach(v=>v.pause());lbBody.innerHTML='';lb.hidden=true;}
lb.querySelector('button').onclick=closeLB;lb.onclick=e=>{if(e.target==lb)closeLB();};
document.addEventListener('keydown',e=>{if(e.key=='Escape'&&!lb.hidden)closeLB();});
document.addEventListener('click',e=>{
  const sh=e.target.closest('.shot');if(sh){openLB(`<video src="${sh.dataset.clip}" controls loop playsinline muted></video>`);return;}
  const im=e.target.closest('.banner,.vcard img,.vui img');if(im){openLB(`<img src="${im.src}" alt="">`);return;}
  const b=e.target.closest('[data-play]');if(b&&window.Arena){window.Arena.playSim(b.dataset.play);}
});
/* clips play on hover (desktop) and lazy-load their source */
function prime(v){if(v&&!v.src&&v.dataset.src)v.src=v.dataset.src;return v;}
document.addEventListener('pointerover',e=>{const f=e.target.closest('.shot');if(f&&e.pointerType=='mouse'){const v=prime(f.querySelector('video'));v.play().catch(()=>{});}});
document.addEventListener('pointerout',e=>{const f=e.target.closest('.shot');if(f&&!f.contains(e.relatedTarget))f.querySelector('video').pause();});

/* ================= difficulty ================= */
let D=store.get('diff','H');
function setDiff(d){D=d;store.set('diff',d);$$('.diff button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.d==d));renderAll();}
$$('.diff button').forEach(b=>b.onclick=()=>setDiff(b.dataset.d));

/* ================= overview ================= */
const GLD={N:50000,H:62000,NM:75000};
function renderOverview(){
  $$('.dname').forEach(e=>e.textContent=DNL()[D]);
  $('#facts').innerHTML=[
    ['Вход GS',ILVL[D]],['Игроков','8'],['Врат','2'],['Энрейдж','10:00 / 13:00','wide'],
    ['Золото',fmt(GOLD[D][0][0]+GOLD[D][1][0])],['Ядра Ark Grid',CORES[D]+' + '+CORES[D]],
    ['Vambrace',(D=='N'?'Specter ×30':'Hand of Death ×30'),'wide'],['Слабость','Holy']
  ].map(([a,b,c])=>`<div class="${c||''}" title="${esc(a)}: ${esc(b)}"><span>${a}</span><b>${b}</b></div>`).join('');
  const rows=['N','H','NM'].flatMap(d=>[0,1].map(g=>{const h=HP[d][g],e=ENR[g];return `<tr class="${d==D?'sel':''}"><td>${DNL()[d]}</td><td>${g?'II · Phetus':'I · Belgardin'}</td><td class="n">${big(h)}</td><td class="n">${big(h/300)}</td><td class="n">${mmss(e)}</td><td class="n">${big(h/e)}/с</td><td class="n">${big(h/e/6)}/с</td></tr>`}));
  $('#hpTable').innerHTML=`<thead><tr><th>Сложн.</th><th>Врата</th><th class="n">HP</th><th class="n">1 полоска</th><th class="n">Энрейдж</th><th class="n">Минимум DPS отряда</th><th class="n">на 1 ДД (6 ДД)</th></tr></thead><tbody>${rows.join('')}<tr><td>Matching (8)</td><td>I / II</td><td class="n">869.7 / 975.3 млрд</td><td class="n" colspan="4">Соло-режим: 66.8 / 93.6 млрд, бесконечные воскрешения</td></tr></tbody>`;
  const nmDps=big(HP.NM[1]/(780*.75)/6)+'/с';
  const SP=[{d:'N',c:'#8fd3bf',il:1750,cp:'3300+',set:'3800–4200',dps:'~600 млн/с',sup:'3000+',f:.62},
            {d:'H',c:'#d4a85a',il:1770,cp:'4500+',set:'4600–5200',dps:'800 млн+/с',sup:'4000+',f:.82},
            {d:'NM',c:'#dc5841',il:1780,cp:'~6 500+ (оценка)',set:'7 000–7 500+',dps:'≈'+nmDps+' (расчёт)',sup:'~5 500+ (оценка)',f:1}];
  $('#spec').innerHTML=SP.map(s=>`<article class="sc ${s.d==D?'sel':''}" style="--c:${s.c}"><div class="sc-h"><b>${DNL()[s.d]}</b><span>${s.d}</span></div><div class="sc-il">${s.il}<small>GS</small></div>
    <dl><div><dt>ДД: БС хватает</dt><dd>${s.cp}</dd></div><div><dt>ДД: типичный набор</dt><dd>${s.set}</dd></div><div><dt>ДД: DPS ориентир</dt><dd>${s.dps}</dd></div><div><dt>Саппорт: БС</dt><dd>${s.sup}</dd></div><span class="bar"><i style="width:${s.f*100}%"></i></span></dl></article>`).join('');
  const sys=[
    ['Holding Just Guard','홀딩 저스트 가드','Новая система. Зажать guard и держать всю серию ударов. Успех — немного урона и гарантированное окно для отряда. Только выдержавшие весь Holding могут взять следующий обычный JG.'],
    ['Insight (Space)','통찰 · 간파','Глитч экрана = скоро Insight. Пробел в нужный момент переносит внутрь, где делается кооп-контра или Holding JG. На N/H подсказка — красная вспышка глаз, на NM — только по анимации.'],
    ['Seeping Chaos','스며드는 혼돈','H/NM, врата I. Стак за попадание особыми атаками (Insight, взрывы призраков, зона Opening JG). На NM 6 стаков — смерть.'],
    ["Necromancer's Curse",'사령의 저주','После 240 по краю врат I — вихрь и зона урона. На 120 он сужается.'],
    ['Grab counter','잡기 횟수','Врата II: под HP Kragma — счётчик захватов отряда. Одновременный захват нескольких считается за каждого.'],
    ['Падение с арены','낙사','Врата II: обрывы весь бой, арена дважды рушится (240 и ~135). Отбрасывания у края — главная причина смертей.'],
    ['Shadow battle item','페투스 안 크라그마의 그림자',"«Shadow of Phetus an Kragma» — особый предмет для механик врат II."],
    ['Сохранение и воскрешения','관문 저장 · 부활','Прогресс по вратам сохраняется. Воскрешения — общий пул отряда. Попытки общие для N/H/NM.']];
  $('#systems').innerHTML=sys.map(([a,k,t])=>`<div class="card"><h3>${a} <span class="ko">${k}</span></h3><p>${t}</p></div>`).join('');
  $('#ph1hp').textContent='HP '+big(HP[D][0]);$('#ph2hp').textContent='HP '+big(HP[D][1]);
  const st=$$('#heroStats div');st[0].querySelector('b').textContent=ILVL[D];st[0].querySelector('span').textContent='GS · '+DNL()[D];
  st[3].querySelector('b').textContent=GLD[D].toLocaleString(LOC());st[3].querySelector('span').textContent=T('Золото')+' · '+DNL()[D];
}

/* ================= gimmick timelines + media viewer ================= */
const RAIL={1:{max:300,list:[[240,1],[195,2],[120,3],[80,4],[0,5]]},2:{max:360,list:[[360,0],[320,1],[300,2],[280,3],[240,4],[195,5],[135,6],[100,7],[80,8],[0,9]]}};
const GV={1:{tl:null,i:-1,m:0},2:{tl:null,i:-1,m:0}};
function mediaThumb(m){return m.yt?'img/gimmicks/yt-g1.jpg':posterOf(m);}
function inlineMedia(x){if(!x.m)return '';return `<div class="tl-inline"><div class="shots">${x.m.map(m=>m.v?`<figure class="shot" data-clip="${m.v}"><video data-src="${m.v}" poster="${posterOf(m)}" muted loop playsinline preload="none"></video><b>${esc(m.c)}</b></figure>`:m.yt?`<a class="shot" href="${ytUrl(m)}" target="_blank" rel="noopener" style="display:block"><img src="img/gimmicks/yt-g1.jpg" alt="" style="width:100%;height:100%;object-fit:cover"><b>▶ ${esc(m.c)}</b></a>`:`<figure class="shot"><img class="banner natural" src="${m.i}" alt="${esc(m.c)}" style="height:100%;border:0;border-radius:0"><b>${esc(m.c)}</b></figure>`).join('')}</div></div>`;}
function renderTL(g){
  const tl=g==1?TL1:TL2,el=$('#tlG'+g);GV[g].tl=tl;
  el.innerHTML=tl.map((x,i)=>`<div class="tl-item" data-i="${i}" tabindex="0"><span class="tl-bar">${x.bar}</span><h3>${x.t} ${x.ko?`<span class="ko">${x.ko}</span>`:''}</h3><p data-trh>${x.p}</p>${x.d&&x.d[D]?`<div class="dnote">${DNL()[D]}: <span data-trh>${x.d[D]}</span></div>`:''}
    <div class="tl-acts">${x.sim?`<button class="btn sm" data-play="${x.sim}">▶ 3D-схема</button>`:''}${x.m?`<span class="mcount">🎬 ${x.m.length} медиа</span>`:''}</div>${inlineMedia(x)}</div>`).join('');
  el.querySelectorAll('.tl-item').forEach(it=>{it.onclick=e=>{if(e.target.closest('[data-play],.shot,a'))return;setGV(g,+it.dataset.i,0);};it.onkeydown=e=>{if(e.key=='Enter')setGV(g,+it.dataset.i,0);};});
  const firstWithMedia=tl.findIndex(x=>x.m);setGV(g,GV[g].i>=0?GV[g].i:firstWithMedia,GV[g].m||0,true);
}
function setGV(g,i,mi,quiet){
  const S=GV[g],x=S.tl[i];if(!x)return;S.i=i;S.m=mi;
  $$('#tlG'+g+' .tl-item').forEach(e=>e.classList.toggle('act',+e.dataset.i==i));
  $$('#rail'+g+' .mk').forEach(m=>m.classList.toggle('cur',+m.dataset.tl==i));
  const v=$('#gv'+g);if(!v)return;
  if(!x.m||!x.m.length){v.innerHTML=`<div class="gv-h"><b>${x.t}</b><span>${x.bar}</span></div><div class="gv-empty">Для этой механики нет клипа — смотри 3D-схему.</div>`;return;}
  const m=x.m[Math.min(mi,x.m.length-1)];
  const main=m.v?`<video src="${m.v}" poster="${posterOf(m)}" muted loop playsinline autoplay></video>`:m.yt?`<a class="yt" href="${ytUrl(m)}" target="_blank" rel="noopener"><img src="img/gimmicks/yt-g1.jpg" alt=""><span>Открыть на YouTube<br><small>${esc(m.c)}</small></span></a>`:`<img src="${m.i}" alt="${esc(m.c)}">`;
  v.innerHTML=`<div class="gv-h"><b>${x.t}</b><span>${x.bar}</span></div><div class="gv-main" data-k="${m.v?'v':m.yt?'y':'i'}">${main}</div><div class="gv-cap">${esc(m.c)}</div>${x.m.length>1?`<div class="gv-th">${x.m.map((q,k)=>`<button type="button" class="${k==mi?'on':''}" data-k="${k}" title="${esc(q.c)}"><img src="${mediaThumb(q)}" alt=""><i>${q.v?'▶':q.yt?'YT':'IMG'}</i></button>`).join('')}</div>`:''}`;
  const vid=v.querySelector('video');if(vid){vid.play().catch(()=>{});}
  v.querySelectorAll('.gv-th button').forEach(b=>b.onclick=()=>setGV(g,i,+b.dataset.k));
  const mm=v.querySelector('.gv-main');mm.onclick=e=>{if(mm.dataset.k=='y')return;if(m.v)openLB(`<video src="${m.v}" controls loop playsinline muted></video>`);else openLB(`<img src="${m.i}" alt="">`);};
}
function rail(g){
  const R=RAIL[g],el=$('#rail'+g),tl=g==1?TL1:TL2;
  el.innerHTML=`<div class="rail-bar">${R.list.map(([b,ti])=>`<button class="mk" type="button" style="left:${(1-b/R.max)*100}%" data-tl="${ti}" title="${tl[ti].bar} — ${esc(tl[ti].t)}"><span>${tl[ti].bar}</span></button>`).join('')}</div><div class="rail-ends"><span>${R.max} ПОЛОСОК</span><span>0</span></div>`;
  el.querySelectorAll('.mk').forEach(m=>m.onclick=()=>{const ti=+m.dataset.tl;setGV(g,ti,0);const it=$(`#tlG${g} .tl-item[data-i="${ti}"]`);if(it)it.scrollIntoView({behavior:'smooth',block:'center'});});
}
/* the viewer follows the item that is in the middle of the screen */
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const it=e.target,g=it.closest('#tlG1')?1:2;if(GV[g].i!=+it.dataset.i&&matchMedia('(min-width:981px)').matches)setGV(g,+it.dataset.i,0);}),{rootMargin:'-45% 0px -45% 0px'});
  window.__observeTL=()=>$$('.tl-item').forEach(i=>io.observe(i));}

/* ================= attack lists ================= */
const TAGN={kd:'сбитие',stag:'стаггер',grab:'захват',jg:'JG',death:'смерть',cnt:'контра',fall:'падение'};
function renderList(el,list,gate){
  el.innerHTML=list.map(p=>{const th=SHOTS[p.sim]?`<img class="pth" src="img/screens/${p.sim}-1.jpg" alt="" loading="lazy">`:'';
   return `<details class="pat" data-cat="${p.c}" data-q="${esc((p.n+' '+p.ko+' '+p.t+' '+(p.dn||'')+' '+T(p.t)+' '+T(p.dn||'')).toLowerCase().replace(/<[^>]+>/g,''))}">
   <summary>${th}<h3>${p.n} <span class="ko">${p.ko}</span></h3><span class="stars">${p.c=='insight'?'INSIGHT':'★'.repeat(Math.min(p.s,7))}</span></summary>
   <div class="body"><div class="tags">${p.c=='red'?'<span class="tag t-death">красный</span>':''}${p.tg.map(t=>`<span class="tag t-${t}">${TAGN[t]}</span>`).join('')}</div>
   <p data-trh>${p.t}</p>${p.dn?`<div class="diffnote" data-trh>${p.dn}</div>`:''}${shotsHTML(p.sim)}${p.sim=='coffinA'?shotsHTML('coffinB'):''}
   <div style="display:flex;gap:6px;flex-wrap:wrap">${p.sim?`<button class="btn sm" data-play="${p.sim}">▶ 3D-схема</button>`:''}${p.sim=='coffinA'?`<button class="btn sm" data-play="coffinB">▶ 3D: по очереди</button>`:''}<a class="btn sm" href="${gate==1?URL1:URL2}" target="_blank" rel="noopener">Гайд Inven ↗</a></div></div></details>`;}).join('');
  el.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)d.querySelectorAll('video').forEach(prime);}));
}
function bindFilters(){
  $$('.filters[data-for]').forEach(f=>{const list=$('#list'+(f.dataset.for=='g1'?'G1':'G2'));let cat='all';
    const run=()=>{const q=f.querySelector('input').value.trim().toLowerCase();list.querySelectorAll('.pat').forEach(p=>{const okC=cat=='all'||p.dataset.cat==cat;p.hidden=!(okC&&(!q||p.dataset.q.includes(q)));});};
    f.querySelector('input').oninput=run;
    f.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{cat=b.dataset.f;f.querySelectorAll('[data-f]').forEach(x=>x.classList.toggle('on',x==b));run();});});}

/* ================= calculators ================= */
const v=id=>+($('#'+id).value)||0;
function tier(p){return p>=.20?['Топ (20%+)','p-top']:p>=.166?['1 доля+','p-ok']:p>=.15?['Уверенно (15%+)','p-ok']:p>=.12?['Ниже доли','p-warn']:['Слабо','p-bad'];}
function calcDps(){
  const g=v('dGate'),t=v('dMin')*60+v('dSec'),dmg=v('dDmg')*(+$('#dUnit').value),hp=HP[D][g];
  const share=dmg/hp,dps=t?dmg/t:0,[tl,tc]=tier(share);
  $('#dOut').innerHTML=`<div><b>${(share*100).toFixed(1)}%</b><span>доля HP врат</span></div><div><b>${big(dps)}</b><span>мой DPS, /с</span></div><div><b><span class="pill ${tc}">${tl}</span></b><span>оценка (из 6 ДД)</span></div><div><b>${big(hp)}</b><span>HP · ${DNL()[D]}</span></div>`;
  $('#dMeter').style.width=Math.min(100,share/.2*100)+'%';
  $('#dTable').innerHTML=`<thead><tr><th>Порог</th><th class="n">Урон</th><th class="n">в 억</th><th class="n">DPS при ${mmss(t)}</th></tr></thead><tbody>${[[.15,'Уверенно 15%'],[.166,'1 доля 16.6%'],[.20,'Топ 20%']].map(([p,n])=>`<tr><td>${n}</td><td class="n">${big(hp*p)}</td><td class="n">${fmt(hp*p/1e8)}</td><td class="n">${t?big(hp*p/t):'—'}</td></tr>`).join('')}</tbody>`;}
function calcRdy(){
  const role=$('#rRole').value,il=v('rIlvl'),cp=v('rCp'),dps=v('rDps')*1e6,up=Math.max(.4,v('rUp')/100);
  const CP={dd:{N:[3300,3800],H:[4500,4800],NM:[6500,7000]},sup:{N:[3000,3300],H:[4000,4300],NM:[5500,5800]}};
  $('#rTable').innerHTML=`<thead><tr><th>Сложн.</th><th>GS</th><th>Боеспособность (БС)</th><th class="n">Нужный DPS (врата II)</th><th>Итог</th></tr></thead><tbody>${['N','H','NM'].map(d=>{
    const need=HP[d][1]/(780*up)/6,ilOk=il>=ILVL[d],c=CP[role][d];let cpS,cpL;
    if(!c){cpS='p-warn';cpL='нет данных';}else if(cp>=c[1]){cpS='p-ok';cpL='комфортно';}else if(cp>=c[0]){cpS='p-ok';cpL='хватает';}else if(cp>=c[0]*.92){cpS='p-warn';cpL='впритык';}else{cpS='p-bad';cpL='мало';}
    let dpsL='',score=0;if(role=='dd'){const r=dps/need;dpsL=` · у тебя ${Math.round(r*100)}%`;score=r>=1.1?2:r>=.95?1:0;}else{score=cpS=='p-ok'?2:cpS=='p-warn'?1:0;}
    const res=!ilOk?['Не пустит','p-bad']:(role=='dd'?(score==2&&cpS!='p-bad'?['Готов','p-ok']:score>=1?['Рискованно','p-warn']:['Рано','p-bad']):(score==2?['Готов','p-ok']:score==1?['Рискованно','p-warn']:['Рано','p-bad']));
    return `<tr class="${d==D?'sel':''}"><td>${DNL()[d]}</td><td><span class="pill ${ilOk?'p-ok':'p-bad'}">${ILVL[d]}${ilOk?' ✓':' ✗'}</span></td><td><span class="pill ${cpS}">${cpL}</span></td><td class="n">${role=='dd'?big(need)+'/с'+dpsL:'—'}</td><td><span class="pill ${res[1]}">${res[0]}</span></td></tr>`}).join('')}</tbody>`;}
function calcPace(){
  const g=v('pGate'),t=v('pMin')*60+v('pSec'),bar=Math.min(300,Math.max(0,v('pBar'))),hp=HP[D][g],e=ENR[g];
  const done=(300-bar)/300,proj=done>0?t/done:0,dps=t?hp*done/t:0,ok=proj&&proj<=e;
  $('#pOut').innerHTML=`<div><b>${big(hp*bar/300)}</b><span>осталось HP</span></div><div><b>${big(hp/300)}</b><span>HP одной полоски</span></div><div><b>${big(dps)}/с</b><span>темп отряда</span></div><div><b>${proj?mmss(proj):'—'}</b><span>прогноз килла <span class="pill ${ok?'p-ok':'p-bad'}">${proj?(ok?'успеваем':'энрейдж'):'—'}</span></span></div><div><b>${big(hp/e)}/с</b><span>нужно без простоев</span></div>`;}

/* ================= rewards ================= */
function icon(k){const it=IT[k];return `<span class="ico c-${it.c}"><b>${it.g}</b>${it.i?`<img src="img/items/${k}.png" alt="" loading="lazy" onerror="this.remove()">`:''}</span>`;}
function itemRow(k,q){return `<div class="item">${icon(k)}<span class="nm">${IT[k].n}</span><span class="qty">${typeof q=='number'?fmt(q):q}</span></div>`;}
function renderRewards(){
  $('#rwGates').innerHTML=[0,1].map(g=>{const [gold,more]=GOLD[D][g],r=RW[D][g];
    return `<div class="card gatebox"><div class="head"><h3>Врата ${g?'II':'I'}</h3><span class="goldline">${fmt(gold)} G</span><span class="muted num">«Ещё»: −${fmt(more)} G</span></div>
    <div class="kicker">За прохождение</div><div class="items">${itemRow('gold',gold)}${r.clear.map(([k,q])=>itemRow(k,q)).join('')}</div>
    ${r.more?`<div class="kicker">«Ещё награда»</div><div class="items">${r.more.map(([k,q])=>itemRow(k,q)).join('')}</div>`:''}</div>`}).join('');
  $('#rwNote').textContent=D=='N'?'Нормал: полный список с прохождения и «Ещё» (данные Lobal). На матчинге (1750) половина золота — привязанная: 10 000 + 10 000 и 15 000 + 15 000.':
   (D=='H'?'Hard':'Nightmare')+': золото, Hand of Death и ядра — из патчноута; книги «Трепет» выпадают с шансом (только H/NM, для заточки оружия и брони, не Vambrace). «Ещё»: Hand of Death 12 / 18 (как в прохождении — по срокам Vambrace из статьи Inven), кристаллы, Great Fate Leapstone и Transfer Leapstone — по таблице LOAGG; Fate Fragment там тоже есть, но количество не опубликовано («?»). Полный список — в игре, кнопка «Gate Info». По рынку октября 2026 «Ещё» на '+(D=='H'?'H окупается примерно на +19 тыс.':'NM окупается примерно на +21 тыс.')+' (если материалы нужны персонажу).';
  renderVambInfo();vSlider();}
/* ================= Vambrace: damage + honing ================= */
const VART=1/2.15; // artisan's energy per fail = 46.51% of the tap's total rate
function vStage(p0,g){let art=0,reach=1,E=0,EG=0,k=1;for(;;){if(art>=1-1e-9){E+=reach;return{E,EG,M:k};}const p=Math.min(1,p0+g+Math.min(p0,p0*.1*(k-1)));E+=reach;EG+=reach;reach*=(1-p);art+=p*VART;k++;if(reach<1e-12)return{E,EG,M:k};}}
const VCP_PTS=[[0,0],[10,VB_CP[10]],[15,VB_CP[15]],[20,VB_CP[20]],[25,VB_CP[25]]];
function cpAt(n){for(let i=1;i<VCP_PTS.length;i++){const [a,va]=VCP_PTS[i-1],[b,vb]=VCP_PTS[i];if(n<=b)return va+(vb-va)*(n-a)/(b-a);}return VB_CP[25];}
const VGRADE_C={'Эпик':'#a77fe4','Легенда':'#e4913d','Реликт':'#dc5841','Древний':'#e9d6ad'};
function renderVambInfo(){
  $('#vStatT').innerHTML=`<thead><tr><th>Заточка</th><th>Грейд</th><th class="n">Атака оружия</th><th class="n">Сила / Ловк. / Инт.</th><th class="n">Выносл.</th><th class="n">Защита</th><th class="n">Базовая атака</th><th class="n">Рост БС</th></tr></thead><tbody>${VB_STAT.map(s=>`<tr><td class="num">+${s.lv}</td><td><span class="pill" style="color:${VGRADE_C[s.g]};background:color-mix(in srgb,${VGRADE_C[s.g]} 16%,transparent)">${s.g}</span></td><td class="n">${fmt(s.wa)}</td><td class="n">${fmt(s.main)}</td><td class="n">${fmt(s.vit)}</td><td class="n">${fmt(s.def)}</td><td class="n">${s.ba?fmt(s.ba):'—'}${s.bap?` <b>+${s.bap}%</b>`:''}</td><td class="n">${VB_CP[s.lv]?'<b>+'+VB_CP[s.lv].toFixed(2)+'%</b>':'—'}</td></tr>`).join('')}</tbody>`;
  const mx=Math.max(...Object.values(VB_STEP).map(v=>v[0]));
  $('#vBars').innerHTML=Object.entries(VB_STEP).map(([n,[pc,g]])=>{const c=n<=15?'#e4913d':n<=20?'#dc5841':'#e9d6ad';const h=pc/mx*100;
    return `<div class="vbar" title="+${n-1} → +${n}: +${pc}% БС, ~${fmt(g/1e3)} тыс. золота за 1%" style="--c:${c}"><b style="bottom:calc(${h}% + 16px)">${pc}</b><i style="height:${h}%"></i><span>${n}</span></div>`;}).join('');
}
const VS={br:'0',luck:'avg',src:'H'};
const plural=(n,one,few,many)=>{const m=n%10,h=n%100;return m==1&&h!=11?one:m>=2&&m<=4&&(h<12||h>14)?few:many;};
const MAT=[['ff','Fate Fragment','#e8d7b4'],['fdc','Fate Destruction Stone Crystal','#ff8b6b'],['fgc','Fate Guardian Stone Crystal','#8fb9ff'],['gfl','Great Fate Leapstone','#c49bff'],['abidos','Superior Abidos Fusion Material','#ffc061'],['gold','Золото','#e6c27c'],['silver','Серебро (Silling)','#cfd3dc'],['glacier',"Glacier's Breath",'#7ad0ff'],['lava',"Lava's Breath",'#ff7a4a']];
const GRADE_AT=n=>n<=10?'#a77fe4':n<=15?'#e4913d':n<=20?'#dc5841':'#e9d6ad';
const BAND_C=['#66d29e','#d8c35c','#e4913d','#dc5841','#ff5a7a'];
const ico=(k,t)=>`<img src="img/items/${k}.png" alt="${t||''}" title="${t||''}">`;
const short=n=>{const L=LG();if(L=='zh')return n>=1e4?fmt(n/1e4,n>=1e6?0:1)+' 万':fmt(n);return n>=1e6?fmt(n/1e6,n>=1e7?0:1)+(L=='en'?' M':' млн'):fmt(n);};
function vSlider(e){
  const f=$('#vFrom'),t=$('#vTo');let a=+f.value,b=+t.value;
  if(a>=b){if(e&&e.target===f){a=Math.min(a,24);b=a+1;}else{b=Math.max(b,1);a=b-1;}f.value=a;t.value=b;}
  const tr=$('.dual-track'),w=tr.clientWidth||1,L=a/25*w,W=(b-a)/25*w,fill=$('#vFill');
  fill.style.left=L+'px';fill.style.width=W+'px';
  fill.style.background=`linear-gradient(90deg,#a77fe4 0 40%,#e4913d 40% 60%,#dc5841 60% 80%,#e9d6ad 80%) ${-L}px 0/${w}px 100% no-repeat`;
  const lbl=$('#vRangeLbl');lbl.textContent=`+${a} → +${b}`;lbl.style.setProperty('--c1',GRADE_AT(a||1));lbl.style.setProperty('--c2',GRADE_AT(b));
  f.style.zIndex=a>20?3:2;t.style.zIndex=a>20?2:3;
  calcVamb();
}
function calcVamb(){
  const from=+$('#vFrom').value,to=+$('#vTo').value,{br,luck,src}=VS,have=v('vHave');
  const T={taps:0,gold:0,silver:0,ff:0,fdc:0,fgc:0,gfl:0,abidos:0,lava:0,glacier:0};const rows=[];
  for(let n=from+1;n<=to;n++){
    const [p0,ush,usi,sh,dsc,gsc,lp,ab,gold,sil]=VB[n-1],band=Math.floor((n-1)/5),perType=VB_BREATH[band];
    const g=br=='2'?p0:br=='g'?p0/2:0,st=vStage(p0,g);
    const taps=luck=='best'?1:luck=='worst'?st.M:st.E,grace=luck=='best'?1:luck=='worst'?st.M-1:st.EG;
    T.taps+=taps;T.gold+=gold*taps;T.silver+=usi+sil*taps;T.ff+=ush+sh*taps;T.fdc+=dsc*taps;T.fgc+=gsc*taps;T.gfl+=lp*taps;T.abidos+=ab*taps;
    if(br!='0'){T.glacier+=perType*grace;if(br=='2')T.lava+=perType*grace;}
    const bc=BAND_C[band];
    rows.push(`<tr><td class="st" style="--c:${GRADE_AT(n)}">+${n-1}→+${n}</td><td class="n ch" style="--c:${bc}">${(p0*100).toFixed(1)}%${g?`<span class="muted"> → ${((p0+g)*100).toFixed(1)}%</span>`:''}</td><td class="n">${taps.toFixed(luck=='avg'?1:0)}</td><td class="n muted">${st.M}</td><td class="n" data-c style="--c:#e6c27c">${short(gold*taps)}</td><td class="n" data-c style="--c:#e8d7b4">${short(ush+sh*taps)}</td><td class="n" data-c style="--c:#ff8b6b">${short(dsc*taps)}</td><td class="n" data-c style="--c:#8fb9ff">${short(gsc*taps)}</td><td class="n" data-c style="--c:#c49bff">${fmt(lp*taps)}</td><td class="n" data-c style="--c:#ffc061">${fmt(ab*taps)}</td></tr>`);
  }
  const bkTxt=[];let need=0,bad=false;
  [10,15,20].forEach(L=>{if(from<=L&&to>L){const [ss,hd]=VB_BREAK[L];if(src=='N'){if(ss){need+=ss;bkTxt.push(`+${L}: ${ss}`);}else bad=true;}else{need+=hd;bkTxt.push(`+${L}: ${hd}`);}}});
  const more=$('#vMore').checked,per=30*(more?2:1),left=Math.max(0,need-have),weeks=Math.ceil(left/per),bk=src=='N'?'sps':'hod';
  $('#vHaveIco').src='img/items/'+bk+'.png';
  const cp=cpAt(to)-cpAt(from);
  $('#vSum').innerHTML=`<div style="--c:#e9d6ad"><b>${luck=='avg'?T.taps.toFixed(1):T.taps}</b><span>попыток всего</span></div>
    <div style="--c:#d4a85a"><b>+${cp.toFixed(1)}%</b><span>БС ≈ урона <small>(полная экипировка)</small></span></div>
    <div style="--c:${bad?'#dc5841':'#ffb3a0'}"><b>${bad?'нельзя':need?ico(bk)+' '+fmt(need):'—'}</b><span>${bad?'прорыв +20 — только Hand of Death (H/NM)':need?'на прорыв · '+bkTxt.join(', '):'прорыв не нужен'}</span></div>
    <div style="--c:#8fd3bf"><b>${need&&!bad?weeks:'—'}</b><span>${need&&!bad?plural(weeks,'неделя','недели','недель'):'недель'} фарма на прорыв <small>(${per}/нед: прохождение 30${more?' + «Ещё» 30':''})</small></span></div>`;
  $('#vSum').querySelectorAll('b img').forEach(i=>{i.style.cssText='width:24px;height:24px;vertical-align:-4px;border-radius:5px';});
  $('#vMats').innerHTML=MAT.map(([k,nm,c])=>{const val=T[k]||0;if((k=='lava'||k=='glacier')&&!val)return '';return `<div class="mchip" style="--c:${c}" title="${nm}: ${fmt(val)}">${ico(k,nm)}<b>${k=='silver'||k=='ff'||k=='gold'?short(val):fmt(val)}</b></div>`;}).join('');
  $('#vCostT').innerHTML=`<thead><tr><th>Ступень</th><th class="n">Шанс</th><th class="n">Попыток</th><th class="n">Гарант</th><th class="n">${ico('gold','Золото')}</th><th class="n">${ico('ff','Fate Fragment')}</th><th class="n">${ico('fdc','Destruction Crystal')}</th><th class="n">${ico('fgc','Guardian Crystal')}</th><th class="n">${ico('gfl','Great Fate Leapstone')}</th><th class="n">${ico('abidos','Abidos')}</th></tr></thead><tbody>${rows.join('')}</tbody>`;
}
$$('.seg2').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{VS[sg.dataset.k]=b.dataset.v;sg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x==b));calcVamb();}));
addEventListener('resize',()=>vSlider());

/* ================= marquee, scroll HP, scrollspy ================= */
const MQ=[['Red Coffin Lasers','레이저'],['Double Swipe → Pizza','휘릭 두번 후 피자안전'],['Medusa','메두사'],['Holding Just Guard','홀딩 저스트 가드'],['Slingshot','새총'],['Annihilation Barrage','소멸 난사'],['Circle Grab','원형 잡기'],['Ritual Disruption','의식 저지'],['Resonance','공명'],['Time Attack','타임어택'],['Blade Insight','칼 간파'],['Vanish Grab','잡기 - 후방안전']];
const row=MQ.map(([e,k])=>`<span>${e}<em>${k}</em></span>`).join('');$('#mq').innerHTML=row+row;
const links=$$('#nav a'),secs=links.map(a=>document.querySelector(a.getAttribute('href')));
function onScroll(){const h=document.documentElement,max=h.scrollHeight-innerHeight,p=max>0?Math.min(1,scrollY/max):0;
  $('#hpFill').style.width=((1-p)*100)+'%';const bars=Math.round(300*(1-p));$('#hpTxt').textContent=bars>0?'×'+bars:'CLEAR';
  let cur=-1;secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<innerHeight*.35)cur=i;});links.forEach((a,i)=>a.classList.toggle('cur',i==cur));}
addEventListener('scroll',onScroll,{passive:true});

/* ================= compare panel for the 3D arena ================= */
let cmpOn=store.get('cmp',false),cmpList=[],cmpI=0;
function cmpShow(i){cmpI=i;const vv=$('#cmpVid');vv.src=cmpList[i];vv.play().catch(()=>{});$$('#cmpNav button').forEach((b,k)=>b.classList.toggle('on',k==i));}
window.onSimBuilt=function(key){cmpList=window.mediaForSim(key);const c=$('#cmp');if(!cmpOn||!cmpList.length){c.hidden=true;$('#btnCmp').disabled=!cmpList.length;$('#btnCmp').title=cmpList.length?'':'Для этой схемы нет клипа';if(!cmpList.length)$('#cmpVid').removeAttribute('src');return;}
  $('#btnCmp').disabled=false;c.hidden=false;$('#cmpNav').innerHTML=cmpList.map((_,i)=>`<button type="button">${i+1}</button>`).join('');$$('#cmpNav button').forEach((b,i)=>b.onclick=()=>cmpShow(i));cmpShow(0);};
$('#btnCmp').onclick=()=>{cmpOn=!cmpOn;store.set('cmp',cmpOn);$('#btnCmp').classList.toggle('on',cmpOn);if(window.Arena)window.onSimBuilt(window.Arena.key);};
$('#btnCmp').classList.toggle('on',cmpOn);
$('#cmpClose').onclick=()=>{cmpOn=false;store.set('cmp',false);$('#btnCmp').classList.remove('on');$('#cmp').hidden=true;$('#cmpVid').pause();};

/* ================= title letters ================= */
const t=$('#title');if(t&&!matchMedia('(prefers-reduced-motion: reduce)').matches){t.innerHTML=[...t.textContent].map((c,i)=>`<span class="ch" style="--i:${i}">${c}</span>`).join('');
  setInterval(()=>{if(document.hidden)return;t.classList.remove('glitch');void t.offsetWidth;t.classList.add('glitch');setTimeout(()=>t.classList.remove('glitch'),450);},7000);}

/* ================= init ================= */
function renderAll(){renderOverview();renderTL(1);renderTL(2);rail(1);rail(2);calcDps();calcRdy();calcPace();renderRewards();if(window.__observeTL)window.__observeTL();}
renderList($('#listG1'),P1,1);renderList($('#listG2'),P2,2);bindFilters();
/* language switch: re-render everything built from numbers and difficulty names */
(window.__i18nHooks=window.__i18nHooks||[]).push(()=>{renderList($('#listG1'),P1,1);renderList($('#listG2'),P2,2);renderAll();$$('.filters[data-for] input').forEach(i=>i.dispatchEvent(new Event('input')));});
['dGate','dMin','dSec','dDmg','dUnit'].forEach(id=>$('#'+id).addEventListener('input',calcDps));
['rRole','rIlvl','rCp','rDps','rUp'].forEach(id=>$('#'+id).addEventListener('input',calcRdy));
['pGate','pMin','pSec','pBar'].forEach(id=>$('#'+id).addEventListener('input',calcPace));
['vFrom','vTo'].forEach(id=>$('#'+id).addEventListener('input',vSlider));$('#vHave').addEventListener('input',calcVamb);$('#vMore').addEventListener('change',calcVamb);
setDiff(D);onScroll();
})();
