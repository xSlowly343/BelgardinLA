/* Belgardin grimoire — language layer (RU source, EN / 中文 translations).
   The page is written in Russian; this module swaps rendered text for the chosen language.
   - text nodes and a few attributes are looked up in I18N_DICT (key = Russian text, whitespace-collapsed)
   - elements marked [data-trh] (paragraphs with inline <b>/<a>) are translated as a whole (key = their HTML)
   - I18N_PAT handles strings with numbers in them
   A MutationObserver keeps anything the scripts render later in the current language. */
(function(){
"use strict";
const DICT=window.I18N_DICT||{},PAT=window.I18N_PAT||[],TITLES=window.I18N_TITLE||{};
const IDX={en:0,zh:1},ATTRS=['placeholder','aria-label','title','alt'];
const LS='belg_lang';
function initial(){
  try{let q=(new URLSearchParams(location.search).get('lang')||'').toLowerCase();if(q=='cn'||q=='zh-cn')q='zh';if(/^(ru|en|zh)$/.test(q))return q;}catch(e){}
  try{const s=localStorage.getItem(LS);if(s&&/^(ru|en|zh)$/.test(s))return s;}catch(e){}
  const n=(navigator.language||'ru').toLowerCase();
  return n.startsWith('zh')?'zh':/^(ru|uk|be|kk)/.test(n)?'ru':n.startsWith('ko')?'en':/^(en|de|fr|es|pt|it|pl|ja)/.test(n)?'en':'ru';
}
let LANG=initial();
const norm=s=>s.replace(/\s+/g,' ').trim();
function tr(s){
  if(LANG==='ru'||s==null)return s;
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s),core=norm(m[2]);if(!core)return s;
  const d=DICT[core];if(d&&d[IDX[LANG]]!=null)return m[1]+d[IDX[LANG]]+m[3];
  for(const p of PAT){if(p[0].test(core)){p[0].lastIndex=0;return m[1]+core.replace(p[0],LANG==='en'?p[1]:p[2])+m[3];}}
  return s;
}
window.T=tr;
Object.defineProperty(window,'LANG',{get:()=>LANG});
window.LOCALE=()=>LANG==='en'?'en-US':LANG==='zh'?'zh-CN':'ru-RU';

let busy=false;
function trText(n){
  if(n.__ru===undefined||n.nodeValue!==n.__out)n.__ru=n.nodeValue;
  const out=tr(n.__ru);n.__out=out;if(n.nodeValue!==out)n.nodeValue=out;
}
function trAttrs(el){
  for(const a of ATTRS){if(!el.hasAttribute(a))continue;const k='__a_'+a,v=el.getAttribute(a);
    if(el[k]===undefined||v!==el[k+'o'])el[k]=v;const out=tr(el[k]);el[k+'o']=out;if(v!==out)el.setAttribute(a,out);}
}
function trHtml(el){
  const cur=el.innerHTML;if(el.__ruh===undefined||cur!==el.__outh)el.__ruh=cur;
  let out=el.__ruh;if(LANG!=='ru'){const d=DICT[norm(el.__ruh)];if(d&&d[IDX[LANG]]!=null)out=d[IDX[LANG]];}
  el.__outh=out;if(cur!==out)el.innerHTML=out;
}
const SKIP={SCRIPT:1,STYLE:1,CANVAS:1,NOSCRIPT:1,TEMPLATE:1};
function walk(root){
  if(!root)return;
  if(root.nodeType===3){const p=root.parentElement;if(p&&p.closest('[data-trh]'))return trHtml(p.closest('[data-trh]'));if(p&&SKIP[p.tagName])return;return trText(root);}
  if(root.nodeType!==1||SKIP[root.tagName]||root.closest('[translate="no"]'))return;
  const host=root.closest('[data-trh]');if(host){trAttrs(host);return trHtml(host);}
  trAttrs(root);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:n=>{
    if(n.nodeType===1){if(n.getAttribute('translate')==='no')return NodeFilter.FILTER_REJECT;if(SKIP[n.tagName]){trAttrs(n);return NodeFilter.FILTER_REJECT;}if(n.hasAttribute('data-trh')){trAttrs(n);trHtml(n);return NodeFilter.FILTER_REJECT;}trAttrs(n);return NodeFilter.FILTER_SKIP;}
    return /\S/.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;}});
  let n;while((n=w.nextNode()))trText(n);
}
const mo=new MutationObserver(ms=>{if(busy)return;busy=true;try{for(const m of ms){
  if(m.type==='childList')m.addedNodes.forEach(walk);
  else if(m.type==='characterData')walk(m.target);
  else if(m.type==='attributes'&&m.target.nodeType===1)trAttrs(m.target);}}finally{busy=false;}});

let RU_TITLE=null;
function setTitle(){const md0=document.querySelector('meta[name=description]');if(!RU_TITLE)RU_TITLE=[document.title,md0?md0.getAttribute('content'):''];const t=LANG==='ru'?RU_TITLE:TITLES[LANG];if(t){document.title=t[0];const md=document.querySelector('meta[name=description]');if(md)md.setAttribute('content',t[1]);}}
function apply(){
  document.documentElement.lang=LANG==='zh'?'zh-CN':LANG;
  document.documentElement.dataset.lang=LANG;
  setTitle();
  busy=true;try{walk(document.body);}finally{busy=false;}
  document.querySelectorAll('.lang button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.l===LANG));
  const ind=document.querySelector('.lang i');const on=document.querySelector('.lang button[aria-pressed=true]');
  if(ind&&on){ind.style.width=on.offsetWidth+'px';ind.style.transform=`translateX(${on.offsetLeft-2}px)`;}
}
function setLang(l){
  if(!/^(ru|en|zh)$/.test(l))return;LANG=l;try{localStorage.setItem(LS,l);}catch(e){}
  (window.__i18nHooks||[]).forEach(f=>{try{f(l);}catch(e){console.warn(e);}});
  apply();
}
window.I18N={setLang,apply,get lang(){return LANG;},walk};
window.__i18nHooks=window.__i18nHooks||[];
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>setLang(b.dataset.l));
  mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  setTimeout(()=>{(window.__i18nHooks||[]).forEach(f=>{try{f(LANG);}catch(e){}});apply();},0);
  addEventListener('resize',()=>{const ind=document.querySelector('.lang i'),on=document.querySelector('.lang button[aria-pressed=true]');if(ind&&on){ind.style.width=on.offsetWidth+'px';ind.style.transform=`translateX(${on.offsetLeft-2}px)`;}});
});
})();
