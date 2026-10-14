/* Belgardin grimoire — hero: official key art (mirrored so he faces the title) under a WebGL overlay
   of drifting fog, moon rays, rising souls, embers, rain and occasional lightning. Click = soul burst from his chest. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero=$('#top'),art=$('#heroArt'),cv=$('#heroGL'),flash=$('#flash');
if(!hero||!art)return;
const FX=.58; // figure centre in the mirrored art (0..1)
let W=0,H=0,box={l:0,t:0,w:0,h:0},mx=0,my=0,tx=0,ty=0,kb=RM?1:1.1,vis=true;

function layout(){
  W=hero.clientWidth;H=hero.clientHeight;
  const w=Math.max(W,H*2)*1.08,h=w/2,portrait=W<H;
  /* landscape: figure on the right third; portrait: frame his face above the text */
  const l=Math.min(0,Math.max(W-w,portrait?W*.5-w*.5:W*.68-w*FX)),t=Math.min(0,Math.max(H-h,portrait?H*.2-h*.27:H*.48-h*.42));
  box={l,t,w,h};Object.assign(art.style,{width:w+'px',height:h+'px',left:l+'px',top:t+'px'});
  if(R){R.setSize(W,H,false);cam.right=W;cam.top=H;cam.updateProjectionMatrix();fogMat.uniforms.uRes.value.set(W,H);}
}
addEventListener('pointermove',e=>{tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5;},{passive:true});
/* chest position on screen (art is mirrored: x' = 1 - x) */
const chest=()=>({x:box.l+box.w*(1-.515)+mx*-18,y:box.t+box.h*.51+my*-10});

/* ================= WebGL overlay ================= */
let R=null,scene,cam,fogMat,pts=[],burst=null,flashV=0,nextBolt=performance.now()+5000;
if(window.THREE&&cv){
  R=new THREE.WebGLRenderer({canvas:cv,antialias:false,alpha:true,premultipliedAlpha:true});
  R.setPixelRatio(Math.min(devicePixelRatio||1,1.5));R.setClearColor(0x000000,0);
  scene=new THREE.Scene();cam=new THREE.OrthographicCamera(0,1,1,0,-10,10);
  const NOISE='float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vn(p);p*=2.02;a*=.5;}return v;}';
  fogMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,uniforms:{uT:{value:0},uRes:{value:new THREE.Vector2(1,1)},uFl:{value:0},uM:{value:new THREE.Vector2()}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy*2.-1.,0.,1.);}',
    fragmentShader:'uniform float uT,uFl;uniform vec2 uRes,uM;varying vec2 vUv;'+NOISE+
    'void main(){vec2 uv=vUv;vec2 p=uv*vec2(uRes.x/uRes.y,1.);'+
    'float f1=fbm(p*1.6+vec2(uT*.035,uT*.01)+uM*.15);float f2=fbm(p*3.2-vec2(uT*.05,-uT*.02)+uM*.3);float fog=smoothstep(.35,.95,f1*.65+f2*.45);'+
    'float low=smoothstep(.75,.0,uv.y);float side=smoothstep(.55,.0,uv.x)*.5;'+
    'vec3 col=mix(vec3(.55,.6,.75),vec3(.62,.52,.85),f2);float a=fog*(.10+low*.42+side*.25);'+
    'vec2 L=vec2(1.02,1.08);vec2 d=uv-L;float ang=atan(d.y,d.x);float rays=pow(fbm(vec2(ang*9.,uT*.05)),2.2)*smoothstep(1.4,.1,length(d));'+
    'col+=vec3(.75,.8,1.)*rays*.6;a+=rays*.16;'+
    'col+=vec3(.8,.85,1.)*uFl*.8;a+=uFl*(.18+fog*.35);'+
    'gl_FragColor=vec4(col*a,a);}'});
  const fq=new THREE.Mesh(new THREE.PlaneGeometry(1,1),fogMat);fq.geometry.translate(.5,.5,0);fq.frustumCulled=false;scene.add(fq);
  // soft glow sprite texture
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(220,255,245,.75)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);
  const DT=new THREE.CanvasTexture(c);
  const PV='attribute float aS;attribute float aA;varying float vA;uniform float uPR;void main(){vA=aA;gl_PointSize=aS*uPR;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const PF='uniform sampler2D uTex;uniform vec3 uC;varying float vA;void main(){vec4 t=texture2D(uTex,gl_PointCoord);gl_FragColor=vec4(uC*t.rgb*vA,t.a*vA);}';
  function layer(n,col,init){const pos=new Float32Array(n*3),S=new Float32Array(n),A=new Float32Array(n),st=[];for(let i=0;i<n;i++)st.push(init(i));
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aS',new THREE.BufferAttribute(S,1));geo.setAttribute('aA',new THREE.BufferAttribute(A,1));
    const m=new THREE.Points(geo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,uniforms:{uTex:{value:DT},uC:{value:new THREE.Color(col)},uPR:{value:R.getPixelRatio()}},vertexShader:PV,fragmentShader:PF}));
    m.frustumCulled=false;scene.add(m);const L={m,st,pos,S,A};pts.push(L);return L;}
  const rnd=Math.random;
  const souls=layer(RM?60:260,0xbff5e6,()=>({x:rnd(),y:rnd(),v:.02+rnd()*.05,s:2+rnd()*rnd()*14,ph:rnd()*6,a:.25+rnd()*.6}));
  souls.step=(p,dt,t)=>{p.y+=p.v*dt;if(p.y>1.05){p.y=-.05;p.x=rnd();}return [p.x*W+Math.sin(t*.6+p.ph)*18*(p.s/8),p.y*H,p.s,p.a*(.6+.4*Math.sin(t*2+p.ph))*Math.min(1,(1.05-p.y)*4)];};
  const embers=layer(RM?20:90,0xff9a5a,()=>({x:.55+rnd()*.5,y:rnd()*.4,v:.03+rnd()*.06,s:1.5+rnd()*3.5,ph:rnd()*6,a:.4+rnd()*.6}));
  embers.step=(p,dt,t)=>{p.y+=p.v*dt;p.x+=Math.sin(t+p.ph)*.0006;if(p.y>.7){p.y=0;p.x=.55+rnd()*.5;}return [p.x*W,p.y*H,p.s,p.a*Math.min(1,(.7-p.y)*3)*(.7+.3*Math.sin(t*7+p.ph))];};
  const purple=layer(RM?10:40,0xb07cff,()=>({r:rnd(),a0:rnd()*6.28,v:.4+rnd()*.8,s:2+rnd()*6,a:.4+rnd()*.5}));
  purple.step=(p,dt,t)=>{const c=chest(),ang=p.a0+t*p.v*.6,rr=20+p.r*90+Math.sin(t*p.v+p.a0)*10;return [c.x+Math.cos(ang)*rr*1.3,H-(c.y+Math.sin(ang)*rr*.6-p.r*30),p.s,p.a*(.5+.5*Math.sin(t*3+p.a0))];};
  // rain
  const RN=RM?0:420,rp=new Float32Array(RN*6),rs=[];for(let i=0;i<RN;i++)rs.push({x:rnd(),y:rnd(),v:.9+rnd()*.7,l:10+rnd()*22});
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rp,3));
  const rain=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xaeb8d6,transparent:true,opacity:.14,depthTest:false}));rain.frustumCulled=false;scene.add(rain);
  // click burst
  const BN=280;burst=layer(BN,0xd8fff3,()=>({x:0,y:0,vx:0,vy:0,life:0,s:2+rnd()*7}));
  burst.step=(p,dt)=>{if(p.life<=0)return [-99,-99,0,0];p.life-=dt*.7;p.vy-=dt*60;p.vx*=.985;p.vy*=.985;p.x+=p.vx*dt;p.y+=p.vy*dt;return [p.x,p.y,p.s,Math.max(0,p.life)];};
  hero.addEventListener('click',e=>{if(e.target.closest('a,button'))return;const c=chest();burst.st.forEach(p=>{const a=rnd()*6.28,v=80+rnd()*420;p.x=c.x;p.y=H-c.y;p.vx=Math.cos(a)*v;p.vy=Math.sin(a)*v+120;p.life=1;});flashV=Math.max(flashV,.35);});
  layout();addEventListener('resize',layout);
  if('IntersectionObserver' in window)new IntersectionObserver(e=>{vis=e[0].isIntersecting;},{threshold:0}).observe(hero);
  let last=performance.now(),T=0;
  (function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(!vis||document.hidden)return;
    T+=RM?dt*.3:dt;mx+=(tx-mx)*.05;my+=(ty-my)*.05;
    art.style.transform=`translate3d(${mx*-18}px,${my*-10}px,0) scale(${kb})`;kb+=(1-kb)*dt*.25;
    if(!RM&&now>nextBolt){nextBolt=now+7000+Math.random()*9000;flashV=1;flash&&(flash.classList.remove('go'),void flash.offsetWidth,flash.classList.add('go'));art.style.filter='brightness(1.7) contrast(1.1)';setTimeout(()=>art.style.filter='',120);setTimeout(()=>{art.style.filter='brightness(1.4)';setTimeout(()=>art.style.filter='',90);},230);}
    flashV=Math.max(0,flashV-dt*1.6);
    fogMat.uniforms.uT.value=T;fogMat.uniforms.uFl.value=flashV;fogMat.uniforms.uM.value.set(mx,my);
    pts.forEach(L=>{for(let i=0;i<L.st.length;i++){const [x,y,s,a]=L.step(L.st[i],dt,T);L.pos[i*3]=x;L.pos[i*3+1]=L===souls||L===embers?y:y;L.pos[i*3+2]=0;L.S[i]=s;L.A[i]=a;}
      L.m.geometry.attributes.position.needsUpdate=true;L.m.geometry.attributes.aS.needsUpdate=true;L.m.geometry.attributes.aA.needsUpdate=true;});
    for(let i=0;i<RN;i++){const r=rs[i];r.y-=r.v*dt;if(r.y<0){r.y=1;r.x=Math.random()*1.2-.1;}const x=r.x*W+(1-r.y)*0,y=r.y*H;rp[i*6]=x;rp[i*6+1]=y;rp[i*6+3]=x-r.l*.35;rp[i*6+4]=y-r.l;}
    if(RN)rg.attributes.position.needsUpdate=true;
    R.render(scene,cam);})(last);
}else{layout();addEventListener('resize',layout);}
})();
