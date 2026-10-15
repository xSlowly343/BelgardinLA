/* Belgardin grimoire — page-wide atmosphere: section backdrops that cross-fade while scrolling,
   drifting motes, cursor glow, video chapter headers and GSAP scroll animations. */
(function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=matchMedia('(pointer:fine)').matches;

/* ---- section backdrops ---- */
const A=$('#ambA'),B=$('#ambB');let front=A,curSrc='';
function setAmb(src){if(!src||src==curSrc)return;curSrc=src;const back=front===A?B:A;back.style.backgroundImage=`url("${src}")`;back.classList.add('on');front.classList.remove('on');front=back;}
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)setAmb(e.target.dataset.amb);}),{rootMargin:'-40% 0px -55% 0px'});$$('[data-amb]').forEach(s=>io.observe(s));}

/* ---- drifting motes (2D canvas, very light) ---- */
const cv=$('#ambFx'),g=cv&&cv.getContext('2d');
if(g&&!RM){let W,H,dpr=Math.min(devicePixelRatio||1,1.5);const P=[];
  function rs(){W=cv.width=innerWidth*dpr;H=cv.height=innerHeight*dpr;}rs();addEventListener('resize',rs);
  for(let i=0;i<70;i++)P.push({x:Math.random(),y:Math.random(),v:.01+Math.random()*.03,s:.6+Math.random()*2.4,ph:Math.random()*6,e:Math.random()<.25});
  let last=performance.now(),sc=0;addEventListener('scroll',()=>{sc=scrollY;},{passive:true});
  (function f(now){requestAnimationFrame(f);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;g.clearRect(0,0,W,H);
    const par=(sc*.00015)%1;
    P.forEach(p=>{p.y-=p.v*dt;if(p.y<-.05){p.y=1.05;p.x=Math.random();}const x=(p.x+Math.sin(now/3000+p.ph)*.01)*W,y=((p.y+par)%1.1)*H,r=p.s*dpr*(p.e?1.2:2.2);
      const gr=g.createRadialGradient(x,y,0,x,y,r*3);const a=.35+.3*Math.sin(now/600+p.ph);gr.addColorStop(0,p.e?`rgba(255,150,90,${a})`:`rgba(190,245,230,${a*.8})`);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r*3,y-r*3,r*6,r*6);});})(last);}

/* ---- cursor glow ---- */
const cg=$('#cursorGlow');if(cg&&fine&&!RM){let x=-999,y=-999,cx=x,cy=y;addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;},{passive:true});(function f(){requestAnimationFrame(f);cx+=(x-cx)*.12;cy+=(y-cy)*.12;cg.style.transform=`translate(${cx}px,${cy}px)`;})();}else if(cg)cg.remove();

/* ---- video chapter headers: load & play only while visible ---- */
if('IntersectionObserver' in window){const vo=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){if(!v.src)v.src=v.dataset.src;if(!RM)v.play().catch(()=>{});}else v.pause();}),{threshold:.05});$$('.vbg').forEach(v=>vo.observe(v));}

/* ---- portal tilt ---- */
if(!RM&&fine)$$('.tilt').forEach(c=>{c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;c.style.setProperty('--ry',(x*7)+'deg');c.style.setProperty('--rx',(-y*7)+'deg');});c.addEventListener('pointerleave',()=>{c.style.setProperty('--ry','0deg');c.style.setProperty('--rx','0deg');});});

/* ---- GSAP scroll choreography ---- */
if(window.gsap&&window.ScrollTrigger&&!RM){
  gsap.registerPlugin(ScrollTrigger);
  // hero: content lifts away, art pushes in
  gsap.to('#heroIn',{y:-140,opacity:0,ease:'none',scrollTrigger:{trigger:'#top',start:'top top',end:'bottom top',scrub:true}});
  gsap.to('#heroGL',{opacity:.3,ease:'none',scrollTrigger:{trigger:'#top',start:'top top',end:'bottom top',scrub:true}});
  gsap.fromTo('.hero-art img',{scale:1},{scale:1.18,yPercent:6,ease:'none',scrollTrigger:{trigger:'#top',start:'top top',end:'bottom top',scrub:true}});
  gsap.from('.eyebrow span,.subtitle,.hero-copy,.cta,.stats',{y:24,opacity:0,duration:1,stagger:.08,delay:.6,ease:'power3.out'});
  // reveals
  ScrollTrigger.batch('.reveal',{start:'top 88%',once:true,onEnter:els=>gsap.fromTo(els,{y:40,opacity:0,filter:'blur(6px)'},{y:0,opacity:1,filter:'blur(0px)',duration:.9,stagger:.08,ease:'power3.out',clearProps:'filter,transform'})});
  // chapter titles: letter-spacing settle + kicker line
  $$('.chapter-head h2').forEach(h=>gsap.from(h,{letterSpacing:'.08em',opacity:.2,duration:1.2,ease:'power2.out',scrollTrigger:{trigger:h,start:'top 85%'}}));
  // parallax inside banners and portals
  $$('.banner:not(.natural)').forEach(im=>gsap.fromTo(im,{objectPosition:'50% 30%'},{objectPosition:'50% 70%',ease:'none',scrollTrigger:{trigger:im,start:'top bottom',end:'bottom top',scrub:true}}));
  $$('.portal .art').forEach(im=>gsap.fromTo(im,{yPercent:-6},{yPercent:6,ease:'none',scrollTrigger:{trigger:im.parentElement,start:'top bottom',end:'bottom top',scrub:true}}));
  // items and source cards cascade
  ScrollTrigger.batch('.item,.src a,.sc,.vcard',{start:'top 92%',once:true,onEnter:els=>gsap.from(els,{y:16,opacity:0,duration:.6,stagger:.03,ease:'power2.out',clearProps:'transform'})});
  // gold counters
  $$('.goldline').forEach(el=>ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>{const to=+el.textContent.replace(/\D/g,'');const o={v:0};gsap.to(o,{v:to,duration:1.2,ease:'power3.out',onUpdate:()=>el.textContent=Math.round(o.v).toLocaleString(window.LOCALE?window.LOCALE():'ru-RU')+' G'});}}));
  // a lightning flash when gate II comes into view
  ScrollTrigger.create({trigger:'#g2',start:'top 60%',onEnter:()=>{const f=$('#flash');if(f){f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}}});
  addEventListener('load',()=>ScrollTrigger.refresh());
}
})();
