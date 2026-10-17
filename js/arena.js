/* Belgardin grimoire — 3D mechanic arena (three.js r128).
   Plays the scripted mechanics from data.js (SIMS). Procedural environments, bosses and telegraphs;
   party members use the animated Soldier model (js/soldier-glb.js) with a capsule fallback. */
(function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas=$('#arena');
if(!canvas)return;
const deg=Math.PI/180;
const COL=C; // telegraph colours from data.js

let R,scene,cam,composer,bloom,DOT,FLASH=[],vfx=[],flashI=0;
let envA,envB,bossA,bossB,arrow,floorMesh,floorA,floorB,clockA,clockB,skyA,skyB,fogLayers=[],ash,souls;
let party=[],partyReady=false,mixers=[],blobs,auraA,auraB,ribA,ribB,gMark,GRADE=null;
let objs=[],fx=[],shocks=[],sim=null,simKey='',T=0,lastT=0,playing=!RM,spd=1,visible=true,shake=0;
let camSaved=null,camMode='orbit',az=0,el=48,dist=23,showLabels=true,showClock=true,me=-1;
const camPos=new THREE.Vector3(0,14,20),camLook=new THREE.Vector3(0,1,0);
const tmpV=new THREE.Vector3(),tmpV2=new THREE.Vector3();

/* ================= procedural textures ================= */
function cTex(w,h,fn,srgb){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=8;if(srgb!==false)t.encoding=THREE.sRGBEncoding;return t;}
function rnd(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function noiseFill(g,s,base,amp,seed){const r=rnd(seed),img=g.getImageData(0,0,s,s),d=img.data;for(let i=0;i<d.length;i+=4){const n=(r()-.5)*amp;d[i]=Math.max(0,Math.min(255,d[i]+n*base[0]));d[i+1]=Math.max(0,Math.min(255,d[i+1]+n*base[1]));d[i+2]=Math.max(0,Math.min(255,d[i+2]+n*base[2]));}g.putImageData(img,0,0);}
/* radial flagstone floor; returns colour, bump and emissive maps */
function floorMaps(g2){
  const S=1024,r=rnd(g2?7:3),stones=[];
  for(let ring=0,rad=70;rad<505;ring++){const w=ring==0?70:58+r()*16,n=Math.max(6,Math.round(2*Math.PI*(rad+w/2)/(70+r()*26))),off=r();for(let i=0;i<n;i++)stones.push([rad,rad+w,(i+off)/n*Math.PI*2,(i+1+off)/n*Math.PI*2,r()]);rad+=w;}
  const path=(g,s,sh)=>{const [a,b,t0,t1]=s,c=S/2;g.beginPath();g.arc(c,c,b-sh,t0+sh/b,t1-sh/b);g.arc(c,c,a+sh,t1-sh/(a+1),t0+sh/(a+1),true);g.closePath();};
  const map=cTex(S,S,(g)=>{
    g.fillStyle=g2?'#120d17':'#1a171c';g.fillRect(0,0,S,S);
    g.beginPath();g.arc(S/2,S/2,70,0,7);g.fillStyle=g2?'#2a2030':'#3a363c';g.fill();
    stones.forEach(s=>{const v=s[4];path(g,s,2.5);const L=g2?18+v*14:44+v*20;g.fillStyle=g2?`hsl(${275+v*20},${12+v*8}%,${L*.6}%)`:`hsl(${250+v*30},${4+v*5}%,${L*.42}%)`;g.fill();});
    noiseFill(g,S,[1,1,1],g2?26:34,11);
    // wear, stains, moss
    for(let i=0;i<70;i++){const x=r()*S,y=r()*S,rr=20+r()*90,gr=g.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,g2?'rgba(120,20,30,.18)':(r()<.4?'rgba(40,60,35,.22)':'rgba(0,0,0,.25)'));gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-rr,y-rr,rr*2,rr*2);}
    g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=1.2;for(let i=0;i<90;i++){let x=r()*S,y=r()*S;g.beginPath();g.moveTo(x,y);for(let j=0;j<6;j++){x+=(r()-.5)*40;y+=(r()-.5)*40;g.lineTo(x,y);}g.stroke();}
    // engraved ritual circles
    g.strokeStyle=g2?'rgba(20,6,26,.9)':'rgba(10,9,12,.85)';[90,200,330,470].forEach((rr,i)=>{g.lineWidth=i%2?3:6;g.beginPath();g.arc(S/2,S/2,rr,0,7);g.stroke();});
    // vignette to the rim
    const gr=g.createRadialGradient(S/2,S/2,300,S/2,S/2,512);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.55)');g.fillStyle=gr;g.fillRect(0,0,S,S);
  });
  const bump=cTex(S,S,(g)=>{g.fillStyle='#000';g.fillRect(0,0,S,S);stones.forEach(s=>{path(g,s,3.5);g.fillStyle=`rgb(${150+s[4]*60|0},${150+s[4]*60|0},${150+s[4]*60|0})`;g.fill();});noiseFill(g,S,[1,1,1],40,5);},false);
  const emi=cTex(S,S,(g)=>{g.fillStyle='#000';g.fillRect(0,0,S,S);
    if(g2){g.lineCap='round';for(let i=0;i<46;i++){let a=r()*Math.PI*2,rr=60+r()*80,x=S/2+Math.cos(a)*rr,y=S/2+Math.sin(a)*rr;g.strokeStyle=r()<.5?'rgba(255,60,50,.9)':'rgba(170,90,255,.85)';g.lineWidth=1+r()*2.5;g.beginPath();g.moveTo(x,y);for(let j=0;j<9;j++){a+=(r()-.5)*.8;rr+=18+r()*30;x=S/2+Math.cos(a)*rr;y=S/2+Math.sin(a)*rr;if(rr>500)break;g.lineTo(x,y);}g.stroke();}}
    else{g.strokeStyle='rgba(143,211,191,.55)';[200,330].forEach(rr=>{g.lineWidth=2;g.beginPath();g.arc(S/2,S/2,rr,0,7);g.stroke();});
      g.font='600 26px serif';g.fillStyle='rgba(143,211,191,.6)';g.textAlign='center';g.textBaseline='middle';const runes='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';for(let i=0;i<48;i++){const a=i/48*Math.PI*2;g.fillText(runes[i%runes.length],S/2+Math.sin(a)*265,S/2-Math.cos(a)*265);}
      g.lineWidth=2;for(let i=0;i<3;i++){const a=i*Math.PI*2/3-Math.PI/2,b=a+Math.PI*2/3;g.beginPath();g.moveTo(S/2+Math.cos(a)*200,S/2+Math.sin(a)*200);g.lineTo(S/2+Math.cos(b)*200,S/2+Math.sin(b)*200);g.stroke();}}
  });
  return {map,bump,emi};
}
/* JS value noise (seeded) for baked textures */
function vnoise(seed){const P=new Uint8Array(512),G=new Float32Array(256),r=rnd(seed);for(let i=0;i<256;i++){P[i]=i;G[i]=r();}for(let i=255;i>0;i--){const j=r()*(i+1)|0,t=P[i];P[i]=P[j];P[j]=t;}for(let i=0;i<256;i++)P[i+256]=P[i];
  const f=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,X=xi&255,Y=yi&255,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=G[P[P[X]+Y]],b=G[P[P[X+1]+Y]],c=G[P[P[X]+Y+1]],d=G[P[P[X+1]+Y+1]];return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};
  return (x,y,o)=>{let s=0,am=.5,fr=1;for(let i=0;i<(o||4);i++){s+=am*f(x*fr,y*fr);fr*=2.03;am*=.5;}return s/(1-Math.pow(.5,o||4));};}
/* Kragma's Field of Annihilation: grey stone with a fibrous, bark-like grain that flows outwards and swirls (clips) */
function floorMapsB(){
  const S=1024,c=S/2,N=vnoise(91),N2=vnoise(13),R=10.5;
  const cv=[document.createElement('canvas'),document.createElement('canvas'),document.createElement('canvas')];cv.forEach(k=>{k.width=k.height=S;});
  const g=cv.map(k=>k.getContext('2d')),im=g.map(x=>x.createImageData(S,S));
  const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const dx=(x-c)/c*R,dy=(y-c)/c*R,r=Math.hypot(dx,dy),i=(y*S+x)*4;
    const warp=(N2(dx*.12+20,dy*.12+20,3)-.5)*.75+r*.02;let a=Math.atan2(dy,dx)+warp;a=((a%(2*Math.PI))+3*Math.PI)%(2*Math.PI)-Math.PI;
    const w=(a+Math.PI)/(2*Math.PI),k=150/(2*Math.PI);
    const grain=N(a*k,r*.22,3)*(1-w)+N((a-2*Math.PI)*k,r*.22,3)*w,band=N(a*k*.18,r*.6+3,2)*(1-w)+N((a-2*Math.PI)*k*.18,r*.6+3,2)*w;
    const fine=N2(dx*2.2,dy*2.2,3),mott=N2(dx*.35+5,dy*.35+5,3);
    let groove=sm(.3,.52,grain);const ring=Math.abs(r-1.55)<.05||Math.abs(r-2.25)<.08?0.25:1;
    let L=(.13+.3*grain+.12*band+.05*fine+.06*mott)*(.45+.55*groove)*ring;L*=1-.45*sm(8.6,10.6,r);
    const tint=mott;im[0].data[i]=Math.min(255,L*(232+tint*14));im[0].data[i+1]=Math.min(255,L*(222));im[0].data[i+2]=Math.min(255,L*(238+(1-tint)*22));im[0].data[i+3]=255;
    const b=Math.min(255,(grain*.8+fine*.2)*255*(.4+.6*groove));im[1].data[i]=im[1].data[i+1]=im[1].data[i+2]=b;im[1].data[i+3]=255;
    const vein=N2(dx*.42-9,dy*.42+3,4),e=sm(.018,.0,Math.abs(vein-.5))*sm(.45,.75,mott)*sm(10.4,9.4,r);
    im[2].data[i]=e*120;im[2].data[i+1]=e*40;im[2].data[i+2]=e*210;im[2].data[i+3]=255;}
  im.forEach((d,j)=>g[j].putImageData(d,0,0));
  // a few deep cracks
  const r=rnd(5);g[0].strokeStyle='rgba(4,3,6,.85)';g[1].strokeStyle='rgba(0,0,0,1)';[g[0],g[1]].forEach((q,qi)=>{const rr=rnd(5);q.lineCap='round';for(let n=0;n<9;n++){let px=c+(rr()-.5)*S*.9,py=c+(rr()-.5)*S*.9,an=rr()*6.3;q.lineWidth=1+rr()*2.5;q.beginPath();q.moveTo(px,py);for(let j=0;j<14;j++){an+=(rr()-.5)*.9;px+=Math.cos(an)*11;py+=Math.sin(an)*11;q.lineTo(px,py);}q.stroke();}});
  const tex=(k,srgb)=>{const t=new THREE.CanvasTexture(k);t.anisotropy=8;if(srgb)t.encoding=THREE.sRGBEncoding;return t;};
  return {map:tex(cv[0],1),bump:tex(cv[1]),emi:tex(cv[2],1)};}
/* organic raised ring (rope of stone / sinew) */
function ridgeRing(R0,tube,seed,turns,dr){const r=rnd(seed),N=vnoise(seed),pts=[],n=160;
  for(let i=0;i<=n;i++){const u=i/n,a=u*Math.PI*2*(turns||1),rad=R0+(dr||0)*u+(N(u*9,1)-.5)*.5;pts.push(new THREE.Vector3(Math.sin(a)*rad,0,-Math.cos(a)*rad));}
  const curve=new THREE.CatmullRomCurve3(pts,!(turns&&turns!=1));const geo=new THREE.TubeGeometry(curve,n*2,tube,12,!(turns&&turns!=1));
  const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+(N(x*1.3+30,z*1.3,3)-.5)*.5;p.setY(i,Math.max(-.02,y*k*.45));}
  geo.computeVertexNormals();const m=new THREE.Mesh(geo,std(0x18151c,{roughness:.9,metalness:.05}));m.castShadow=m.receiveShadow=true;return m;}
function clockTex(g2){return cTex(1024,1024,(g,s)=>{g.font='700 40px "Alegreya SC", Georgia, serif';g.textAlign='center';g.textBaseline='middle';
  for(let i=1;i<=12;i++){const a=i*30*deg,major=i%3==0;g.fillStyle=major?(g2?'rgba(205,170,255,.95)':'rgba(240,210,150,.95)'):'rgba(236,229,215,.55)';g.font=(major?'800 46px':'600 34px')+' "Alegreya SC", Georgia, serif';g.fillText(String(i),s/2+Math.sin(a)*462,s/2-Math.cos(a)*462);}
  g.strokeStyle=g2?'rgba(167,127,228,.55)':'rgba(212,168,90,.55)';g.lineWidth=3;g.beginPath();g.arc(s/2,s/2,506,0,7);g.stroke();
  for(let i=0;i<60;i++){const a=i*6*deg,l=i%5?8:18;g.beginPath();g.moveTo(s/2+Math.sin(a)*(506-l),s/2-Math.cos(a)*(506-l));g.lineTo(s/2+Math.sin(a)*506,s/2-Math.cos(a)*506);g.stroke();}});}
function dotTex(){return cTex(64,64,(g)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.7)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);});}
function clothTex(base,trim){return cTex(256,256,(g,s)=>{g.fillStyle=base;g.fillRect(0,0,s,s);noiseFill(g,s,[1,1,1],22,9);g.strokeStyle='rgba(0,0,0,.25)';for(let x=0;x<s;x+=6){g.lineWidth=1;g.beginPath();g.moveTo(x,0);g.lineTo(x+(Math.sin(x)*4),s);g.stroke();}if(trim){g.fillStyle=trim;g.fillRect(0,s-18,s,10);}});}

/* ================= materials & shaders ================= */
const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.7,metalness:.1},o||{}));
const NOISE='float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vn(p);p*=2.03;a*=.5;}return v;}';
function skyMat(top,mid,bot,moon,moonDir,clouds){return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{uT:{value:0},cTop:{value:new THREE.Color(top)},cMid:{value:new THREE.Color(mid)},cBot:{value:new THREE.Color(bot)},cMoon:{value:new THREE.Color(moon)},mDir:{value:new THREE.Vector3(...moonDir).normalize()},cCl:{value:new THREE.Color(clouds)}},
  vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform float uT;uniform vec3 cTop,cMid,cBot,cMoon,cCl,mDir;varying vec3 vP;'+NOISE+'void main(){vec3 d=normalize(vP);float h=d.y;vec3 col=mix(cBot,cMid,smoothstep(-.1,.18,h));col=mix(col,cTop,smoothstep(.18,.85,h));float m=max(dot(d,mDir),0.);col+=cMoon*(pow(m,900.)*3.+pow(m,40.)*.35+pow(m,6.)*.12);vec2 uv=d.xz/(max(d.y,.04)+.25);float c=fbm(uv*1.6+vec2(uT*.006,uT*.002));float c2=fbm(uv*3.4-vec2(uT*.01,0.));float cl=smoothstep(.42,.78,c*.7+c2*.4)*smoothstep(-.02,.35,h);col=mix(col,cCl*(.6+.6*pow(m,4.)),cl*.75);gl_FragColor=vec4(col,1.);}'});}
function fogMat(col,op,scale,speed){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{uT:{value:0},uC:{value:new THREE.Color(col)},uO:{value:op},uS:{value:scale},uSp:{value:speed}},
  vertexShader:'varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:'uniform float uT,uO,uS,uSp;uniform vec3 uC;varying vec2 vUv;varying vec3 vW;'+NOISE+'void main(){float n=fbm(vW.xz*uS+vec2(uT*uSp,uT*uSp*.6));n=smoothstep(.35,.85,n);float e=1.-smoothstep(.3,.5,length(vUv-.5));float near=smoothstep(8.,14.,length(vW.xz));gl_FragColor=vec4(uC,n*e*uO*mix(.12,1.,near));}'});}
/* telegraphs: in-game style fill growing to the impact, a hot leading front and rim (HDR, so the bloom catches them),
   drifting energy noise inside; Just Guard zones are hatched, safe zones breathe */
const TV='varying vec2 vP;varying vec2 vUv;varying vec3 vW;void main(){vP=position.xy;vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}';
const TF='uniform vec3 uC;uniform float uProg,uA,uFl,uMode,uR0,uR1,uSafe,uT,uHatch;varying vec2 vP;varying vec2 vUv;varying vec3 vW;'+NOISE+
'void main(){float d=uMode<.5?clamp((length(vP)-uR0)/max(.001,uR1-uR0),0.,1.):vUv.y;float a;vec3 col=uC;'+
'float n=fbm(vW.xz*1.4+vec2(uT*.35,-uT*.22));'+
'if(uSafe>.5){float e=smoothstep(.9,1.,d)+(uR0>.01?smoothstep(.1,0.,d):0.);float pulse=.5+.5*sin(uT*4.-d*9.);a=.1+.06*pulse+.08*n+e*.75;col*=1.+e*1.4;}'+
'else{float fill=smoothstep(uProg+.012,uProg-.012,d);float front=smoothstep(.045,0.,abs(d-uProg))*step(uProg,.995);'+
'float edge=smoothstep(.93,1.,d)+(uMode>.5?smoothstep(.05,0.,d):0.)+(uR0>.01?smoothstep(.07,0.,d):0.);'+
'float ripple=.5+.5*sin(d*40.-uT*8.);a=.08+fill*(.2+.16*n+.06*ripple)+front*.9+edge*.8;'+
'if(uHatch>.5){float hs=fract((vW.x+vW.z)*1.75-uT*.7);float h=smoothstep(.0,.06,hs)*smoothstep(.5,.44,hs);a=a*(.42+.9*h)+fill*h*.12;col*=.75+.5*h;}'+
'col*=1.+front*1.8+edge*1.1+fill*n*.3;}'+
'gl_FragColor=vec4(col*(1.+uFl*1.3),clamp(a*uA+uFl*.35,0.,1.));}';
function tMat(c,o){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:TV,fragmentShader:TF,
  uniforms:{uC:{value:new THREE.Color(COL[c]!=null?COL[c]:c)},uProg:{value:0},uA:{value:0},uFl:{value:0},uMode:{value:o.mode||0},uR0:{value:o.r0||0},uR1:{value:o.r1||1},uSafe:{value:c=='safe'?1:0},uHatch:{value:c=='jg'?1:0},uT:{value:0}}});}
function shadowize(o){o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});return o;}

/* ================= environments ================= */
function deadTree(h,r){const g=new THREE.Group(),m=std(0x17141a,{roughness:1});
  (function branch(len,rad,depth,parent,ang,tilt){const geo=new THREE.CylinderGeometry(rad*.6,rad,len,6);geo.translate(0,len/2,0);const b=new THREE.Mesh(geo,m);b.rotation.set(tilt,ang,0);parent.add(b);
    if(depth<4){const n=depth<1?3:2;for(let i=0;i<n;i++){const c=new THREE.Group();c.position.y=len*(.65+r()*.3);b.add(c);branch(len*(.55+r()*.2),rad*.6,depth+1,c,r()*Math.PI*2,.35+r()*.5);}}})(h,h*.07,0,g,0,(r()-.5)*.15);
  return g;}
function spire(r,w,h){const g=new THREE.Group(),m=std(0x0f0d13,{roughness:1}),win=new THREE.MeshBasicMaterial({color:r()<.5?0x2b5f58:0x5a3a20});
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),m);body.position.y=h/2;g.add(body);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(w*.78,h*.55,4),m);roof.position.y=h+h*.27;roof.rotation.y=Math.PI/4;g.add(roof);
  for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.ConeGeometry(w*.16,h*.35,6),m);t.position.set((i%2?1:-1)*w*.5,h+h*.12,(i<2?1:-1)*w*.5);g.add(t);}
  for(let i=0;i<3;i++){const p=new THREE.Mesh(new THREE.PlaneGeometry(w*.18,h*.12),win);p.position.set((i-1)*w*.28,h*(.55+r()*.25),w/2+.01);g.add(p);}
  return g;}
/* soft volumetric light shafts */
const SHAFT_V='varying vec2 vUv;varying vec3 vN,vV;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}';
const SHAFT_F='uniform vec3 uC;uniform float uT,uA,uS;varying vec2 vUv;varying vec3 vN,vV;'+NOISE+'void main(){float e=pow(abs(dot(normalize(vN),normalize(vV))),2.2);float l=smoothstep(0.,.18,vUv.y)*smoothstep(1.,.55,vUv.y);float n=.55+.45*fbm(vec2(vUv.x*6.+uS,vUv.y*2.5-uT*.12));gl_FragColor=vec4(uC,e*l*n*uA);}';
function makeShaft(top,bot,r0,r1,col,a,seed){const d=new THREE.Vector3().subVectors(top,bot),L=d.length();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,L,40,1,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    uniforms:{uC:{value:new THREE.Color(col)},uT:{value:0},uA:{value:a},uS:{value:seed||0}},vertexShader:SHAFT_V,fragmentShader:SHAFT_F}));
  m.position.copy(top).add(bot).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());m.renderOrder=3;return m;}
function makeEnvA(){
  const g=new THREE.Group(),r=rnd(42);
  skyA=new THREE.Mesh(new THREE.SphereGeometry(140,40,24),skyMat(0x06070c,0x161722,0x1e1d29,0xbfc8f0,[-.5,.35,-.8],0x3a3c4c));g.add(skyA);
  // platform rim & steps
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(11.2,11.6,.55,96,1,true),std(0x2b282e,{roughness:.95}));rim.position.y=-.27;g.add(rim);
  const step=new THREE.Mesh(new THREE.RingGeometry(10.5,12.4,96),std(0x232025,{roughness:1}));step.rotation.x=-Math.PI/2;step.position.y=.001;step.receiveShadow=true;g.add(step);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(90,48),std(0x121014,{roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.5;ground.receiveShadow=true;g.add(ground);
  // balustrade
  const postGeo=new THREE.CylinderGeometry(.12,.16,1.1,6),pm=std(0x24212a,{roughness:.9});const posts=new THREE.InstancedMesh(postGeo,pm,96),M=new THREE.Matrix4();
  for(let i=0;i<96;i++){const a=i/96*Math.PI*2;M.makeTranslation(Math.sin(a)*12.1,.55,-Math.cos(a)*12.1);posts.setMatrixAt(i,M);}posts.castShadow=true;g.add(posts);
  const rail=new THREE.Mesh(new THREE.TorusGeometry(12.1,.09,6,128),pm);rail.rotation.x=Math.PI/2;rail.position.y=1.1;g.add(rail);
  // graveyard
  const stoneGeo=new THREE.BoxGeometry(.7,1,.18),stoneTop=new THREE.CylinderGeometry(.35,.35,.18,12,1,false,0,Math.PI);
  const gs=new THREE.InstancedMesh(stoneGeo,std(0x26232b,{roughness:.95}),120),gt=new THREE.InstancedMesh(stoneTop,std(0x26232b,{roughness:.95}),120),Q=new THREE.Quaternion(),E=new THREE.Euler(),Sc=new THREE.Vector3();
  for(let i=0;i<120;i++){const a=r()*Math.PI*2,rr=14+r()*16,h=.7+r()*.8,x=Math.sin(a)*rr,z=-Math.cos(a)*rr;E.set((r()-.5)*.25,-a+(r()-.5)*.6,(r()-.5)*.2);Q.setFromEuler(E);Sc.set(1,h,1);M.compose(new THREE.Vector3(x,h/2-.05,z),Q,Sc);gs.setMatrixAt(i,M);
    const top=new THREE.Matrix4().compose(new THREE.Vector3(0,.5,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,Math.PI/2)),new THREE.Vector3(1,1,1));const T2=new THREE.Matrix4().compose(new THREE.Vector3(x,h-.05,z),Q,new THREE.Vector3(1,1,1)).multiply(top);gt.setMatrixAt(i,T2);}
  gs.castShadow=gt.castShadow=true;g.add(gs,gt);
  for(let i=0;i<14;i++){const a=r()*Math.PI*2,rr=16+r()*14,t=deadTree(2.8+r()*2.5,r);t.position.set(Math.sin(a)*rr,-.2,-Math.cos(a)*rr);g.add(t);}
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2+r()*.2,rr=40+r()*22,s=spire(r,2+r()*3,8+r()*16);s.position.set(Math.sin(a)*rr,-.5,-Math.cos(a)*rr);s.rotation.y=-a;g.add(s);}
  const cath=spire(r,9,26);cath.position.set(-14,-.5,-58);g.add(cath);
  // lanterns with flicker
  g.userData.lights=[];
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.26,rr=12.9;const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,3,6),pm);post.position.set(Math.sin(a)*rr,1.5,-Math.cos(a)*rr);g.add(post);
    const l=new THREE.PointLight(0xffa860,.9,9,2);l.position.set(Math.sin(a)*rr,3.1,-Math.cos(a)*rr);g.add(l);g.userData.lights.push(l);
    const f=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),new THREE.MeshBasicMaterial({color:0xffc27a}));f.position.copy(l.position);g.add(f);}
  // moonlight shafts through the mist
  g.userData.shafts=[[-3,-2,2.6],[4,3,1.8],[-6,5,1.6],[1,-7,1.9]].map(([x,z,w],i)=>{const b=new THREE.Vector3(x,0,z),t=b.clone().add(new THREE.Vector3(-9,18,-12).normalize().multiplyScalar(30));return makeShaft(t,b,w*1.6,w,0x9aa6ff,.055,i*3.1);});g.userData.shafts.forEach(m=>g.add(m));
  // ground fog
  fogLayers=[];[.25,.7,1.3].forEach((y,i)=>{const f=new THREE.Mesh(new THREE.PlaneGeometry(110,110),fogMat(0x34324a,.13-i*.035,.045+i*.02,.25+i*.15));f.rotation.x=-Math.PI/2;f.position.y=y;f.renderOrder=2;g.add(f);fogLayers.push(f);});
  return g;}
function makeEnvB(){
  const g=new THREE.Group(),r=rnd(77);
  skyB=new THREE.Mesh(new THREE.SphereGeometry(140,40,24),skyMat(0x07030c,0x2a0f2e,0x4a1220,0xff7a5a,[.2,.25,-1],0x3a1838));g.add(skyB);
  // floating platform underside
  const ug=new THREE.ConeGeometry(10.6,9,48,6,true);const pa=ug.attributes.position;for(let i=0;i<pa.count;i++){const y=pa.getY(i);if(y<4.4){pa.setX(i,pa.getX(i)*(.8+r()*.35));pa.setZ(i,pa.getZ(i)*(.8+r()*.35));pa.setY(i,y+(r()-.5)*.8);}}ug.computeVertexNormals();
  const under=new THREE.Mesh(ug,std(0x1d1522,{roughness:1,flatShading:true,side:THREE.DoubleSide}));under.rotation.x=Math.PI;under.position.y=-4.6;g.add(under);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(10.55,10.4,.45,64,1,true),std(0x2a2630,{roughness:.9}));rim.position.y=-.22;g.add(rim);
  g.add(ridgeRing(4.5,.2,3),ridgeRing(10.05,.32,8),ridgeRing(9.4,.17,21,.32,-1.4));
  const med=new THREE.Mesh(new THREE.TorusGeometry(1.9,.07,8,96),std(0x3a3540,{roughness:.6,metalness:.25}));med.rotation.x=Math.PI/2;med.position.y=.03;med.receiveShadow=true;g.add(med);
  // void below
  const voidMat=new THREE.ShaderMaterial({depthWrite:false,uniforms:{uT:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uT;varying vec2 vUv;'+NOISE+'void main(){vec2 p=vUv-.5;float r=length(p),a=atan(p.y,p.x);float s=fbm(vec2(a*2.+uT*.05+r*6.,r*8.-uT*.2));vec3 c=mix(vec3(.05,.01,.08),vec3(.55,.08,.18),smoothstep(.45,.9,s)*(1.-r*1.6));c+=vec3(.35,.15,.6)*smoothstep(.6,.95,fbm(p*14.+uT*.03))*.4;gl_FragColor=vec4(c,1.);}'});
  g.userData.voidMat=voidMat;const vp=new THREE.Mesh(new THREE.CircleGeometry(120,64),voidMat);vp.rotation.x=-Math.PI/2;vp.position.y=-22;g.add(vp);
  // floating rocks
  g.userData.rocks=[];for(let i=0;i<34;i++){const a=r()*Math.PI*2,rr=18+r()*24;const geo=new THREE.DodecahedronGeometry(.4+r()*1.3,0);const rk=new THREE.Mesh(geo,std(0x2b2235,{flatShading:true,roughness:1}));rk.position.set(Math.sin(a)*rr,-6+r()*14,-Math.cos(a)*rr);rk.userData.f=r()*6;g.add(rk);g.userData.rocks.push(rk);}
  // bone spikes around the edge
  const sp=new THREE.ConeGeometry(.16,1.5,6);sp.translate(0,.75,0);const spikes=new THREE.InstancedMesh(sp,std(0x5e564f,{roughness:.7}),28),M=new THREE.Matrix4();
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2+r()*.1;const q=new THREE.Quaternion().setFromEuler(new THREE.Euler((r()-.5)*.5,0,(r()<.5?-1:1)*(.2+r()*.4)));M.compose(new THREE.Vector3(Math.sin(a)*10.9,-.2,-Math.cos(a)*10.9),q,new THREE.Vector3(1,.5+r()*.8,1));spikes.setMatrixAt(i,M);}g.add(spikes);
  // Chaktum portal in the sky
  const portal=new THREE.Group();portal.position.set(0,14,-46);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(11,.9,16,96),std(0x2b2433,{metalness:.5,roughness:.4,emissive:0x0b3a3a}));portal.add(ring);
  for(let i=0;i<28;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.35,2.4,5),std(0x3a3044,{roughness:.7}));const a=i/28*Math.PI*2;c.position.set(Math.cos(a)*11.8,Math.sin(a)*11.8,0);c.rotation.z=a-Math.PI/2;portal.add(c);}
  const swirl=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uT:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uT;varying vec2 vUv;'+NOISE+'void main(){vec2 p=vUv-.5;float r=length(p)*2.,a=atan(p.y,p.x);float s=fbm(vec2(a*3.-uT*.4+r*4.,r*6.-uT*.6));float m=smoothstep(1.,.2,r);vec3 c=mix(vec3(.05,.5,.55),vec3(.6,1.,.95),s);gl_FragColor=vec4(c*s*m*1.2,m*.9);}'});
  g.userData.swirl=swirl;const disc=new THREE.Mesh(new THREE.CircleGeometry(10.6,64),swirl);portal.add(disc);g.add(portal);g.userData.portal=portal;
  const pl=new THREE.PointLight(0x4fe0d0,1.2,60,2);pl.position.set(0,14,-40);g.add(pl);
  g.userData.shafts=[makeShaft(new THREE.Vector3(0,14,-44),new THREE.Vector3(0,0,-1),7,3.2,0x4fe0d0,.16,1),
    ...[[-4,3,2.2],[5,-2,2],[1,6,1.6]].map(([x,z,w],i)=>makeShaft(new THREE.Vector3(x*.4+4,34,z*.4-6),new THREE.Vector3(x,0,z),w*2.2,w,0xb48cff,.06,5+i*2))];
  g.userData.shafts.forEach(m=>g.add(m));
  const red=new THREE.PointLight(0xff3a3a,1.4,40,2);red.position.set(0,-6,0);g.add(red);
  fogLayers=fogLayers||[];g.userData.fog=[];[-1.4,-3].forEach((y,i)=>{const f=new THREE.Mesh(new THREE.PlaneGeometry(110,110),fogMat(i?0x6a1030:0x5a2a7a,.5,.05+i*.02,.3+i*.2));f.rotation.x=-Math.PI/2;f.position.y=y;g.add(f);g.userData.fog.push(f);});
  return g;}

/* ================= bosses ================= */
function makeBelgardin(){
  const g=new THREE.Group(),P={};
  const coat=std(0x2a2232,{roughness:.75,map:clothTex('#2a2233','#5b3a7a')}),armor=std(0x1e1a24,{metalness:.75,roughness:.35,emissive:0x12061c}),fur=std(0x9d97a3,{roughness:1}),skin=std(0xb8aeb6,{roughness:.55}),hairM=std(0xb3b0bd,{roughness:.55,metalness:.15});
  const coatGeo=new THREE.LatheGeometry([[0,0],[1.35,0],[1.2,.35],[.95,1.2],[.72,1.9],[.6,2.3],[0,2.3]].map(([x,y])=>new THREE.Vector2(x,y)),40);
  const cp=coatGeo.attributes.position;P.coatBase=Float32Array.from(cp.array);const coatM=new THREE.Mesh(coatGeo,coat);g.add(coatM);P.coat=coatM;
  const capeGeo=new THREE.PlaneGeometry(1.9,3.3,12,18);capeGeo.translate(0,-1.65,0);{const q=capeGeo.attributes.position;for(let i=0;i<q.count;i++){const x=q.getX(i);q.setZ(i,-x*x*.32);}}const capeM=std(0x4a3a5c,{roughness:.6,metalness:.15,side:THREE.DoubleSide,emissive:0x140a22,map:clothTex('#4a3a5c','#9a6ad0')});
  const cape=new THREE.Mesh(capeGeo,capeM);cape.position.set(0,3.25,.55);g.add(cape);P.cape=cape;P.capeBase=Float32Array.from(capeGeo.attributes.position.array);
  const hem=new THREE.Mesh(new THREE.TorusGeometry(1.33,.035,6,64),new THREE.MeshBasicMaterial({color:0x8a5ad0}));hem.rotation.x=Math.PI/2;hem.position.y=.05;g.add(hem);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.58,.66,1.1,18),armor);torso.position.y=2.75;g.add(torso);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.16,16,12),new THREE.MeshBasicMaterial({color:0xb27cff}));core.position.set(0,2.85,-.6);g.add(core);P.core=core;
  const coreL=new THREE.PointLight(0xa070ff,1.2,4,2);coreL.position.set(0,2.85,-.9);g.add(coreL);P.coreL=coreL;
  const collarGeo=new THREE.TorusGeometry(.66,.3,10,28);const cg=collarGeo.attributes.position,r=rnd(9);for(let i=0;i<cg.count;i++){const s=1+(r()-.5)*.35;cg.setXYZ(i,cg.getX(i)*s,cg.getY(i)*s,cg.getZ(i)*(1+(r()-.5)*.6));}collarGeo.computeVertexNormals();
  const collar=new THREE.Mesh(collarGeo,fur);collar.rotation.x=Math.PI/2;collar.position.y=3.3;collar.scale.set(.92,.92,.8);g.add(collar);
  const furD=std(0x6f6976,{roughness:1});
  for(let i=0;i<54;i++){const t=new THREE.Mesh(new THREE.ConeGeometry(.05+r()*.03,.3+r()*.25,4),i%3?fur:furD);const a=i/54*Math.PI*2+r()*.1,rr=.72+r()*.18;t.position.set(Math.cos(a)*rr,3.22+r()*.22,Math.sin(a)*rr);t.rotation.set(Math.sin(a)*(1+r()*.6),r(),-Math.cos(a)*(1+r()*.6));g.add(t);}
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.3,10),skin);neck.position.y=3.5;g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.27,20,16),skin);head.scale.set(.9,1.15,.95);head.position.y=3.82;g.add(head);P.head=head;
  [-.09,.09].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:0xc8a0ff}));e.position.set(x,3.86,-.24);g.add(e);});
  const hair=new THREE.Group();g.add(hair);P.hair=hair;
  for(let i=0;i<9;i++){const a=(i/8-.5)*2.2,x=Math.sin(a)*.24,z=Math.cos(a)*.2+.02;
    const pts=[new THREE.Vector3(x*.8,4.05,z*.6),new THREE.Vector3(x*1.1,3.85,z+.14),new THREE.Vector3(x*1.25,3.3,z+.38+r()*.1),new THREE.Vector3(x*1.3,2.6-r()*.3,z+.52+r()*.12)];
    const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.036-.008*Math.abs(a),6,false),hairM);hair.add(tube);}
  const pauldron=(s)=>{const p=new THREE.Mesh(new THREE.SphereGeometry(.34,16,10,0,Math.PI*2,0,Math.PI/2),armor);p.position.set(.72*s,3.15,0);p.rotation.z=-s*.35;g.add(p);for(let i=0;i<3;i++){const sp=new THREE.Mesh(new THREE.ConeGeometry(.05,.32,5),armor);sp.position.set(.72*s+s*(.05+i*.09),3.42,-.05+i*.05);sp.rotation.z=-s*.6;g.add(sp);}};pauldron(1);pauldron(-1);
  function arm(s){const sh=new THREE.Group();sh.position.set(.74*s,3.05,0);g.add(sh);
    const up=new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.8,10),coat);up.position.y=-.4;sh.add(up);
    const el=new THREE.Group();el.position.y=-.8;sh.add(el);const lo=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,.75,10),armor);lo.position.y=-.37;el.add(lo);
    const sl=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,12,1,true),coat);sl.material=coat;sl.position.y=-.2;el.add(sl);
    const hand=new THREE.Group();hand.position.y=-.78;el.add(hand);const hm=new THREE.Mesh(new THREE.BoxGeometry(.16,.2,.1),armor);hand.add(hm);
    return {sh,el,hand};}
  P.R=arm(1);P.L=arm(-1);
  const sword=new THREE.Group();const bs=new THREE.Shape();bs.moveTo(-.06,0);bs.lineTo(.06,0);bs.lineTo(.04,2.6);bs.lineTo(0,2.85);bs.lineTo(-.04,2.6);bs.closePath();
  const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(bs,{depth:.025,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:1}),std(0xcfd8ea,{metalness:.95,roughness:.15,emissive:0x16203a}));blade.rotation.x=Math.PI;blade.position.y=-.05;sword.add(blade);
  const edge=new THREE.Mesh(new THREE.BoxGeometry(.012,2.5,.04),new THREE.MeshBasicMaterial({color:0x9fe9d5}));edge.position.set(.05,-1.35,0);sword.add(edge);P.edge=edge;
  const guard=new THREE.Mesh(new THREE.TorusGeometry(.18,.035,6,16,Math.PI),std(0xb08a46,{metalness:.9,roughness:.25}));guard.rotation.z=Math.PI;sword.add(guard);
  P.R.hand.add(sword);P.sword=sword;
  const cs=new THREE.Shape();cs.moveTo(0,.9);cs.lineTo(.36,.62);cs.lineTo(.28,-.9);cs.lineTo(-.28,-.9);cs.lineTo(-.36,.62);cs.closePath();
  const cof=new THREE.Mesh(new THREE.ExtrudeGeometry(cs,{depth:.24,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:1}),std(0x2a1c1a,{metalness:.35,roughness:.55,emissive:0x2a0605}));cof.geometry.center();cof.position.y=-.7;cof.rotation.x=Math.PI/2;P.L.hand.add(cof);P.cof=cof;cof.visible=false;
  // folded wings (open on "flap")
  P.wings=[];[-1,1].forEach(s=>{const w=new THREE.Group();w.position.set(.25*s,3.15,.32);g.add(w);
    const fm=std(0x150f1d,{roughness:.6,side:THREE.DoubleSide,emissive:0x0b0414});
    for(let i=0;i<7;i++){const sh=new THREE.Shape();sh.moveTo(0,0);sh.quadraticCurveTo(.25,.8,0,1.9+i*.12);sh.quadraticCurveTo(-.22,.8,0,0);const f=new THREE.Mesh(new THREE.ShapeGeometry(sh,6),fm);f.rotation.z=s*(.25+i*.2);f.position.x=s*i*.05;w.add(f);}
    w.userData.s=s;P.wings.push(w);});
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.62,.025,6,48),new THREE.MeshBasicMaterial({color:0xd4a85a}));halo.position.set(0,4.05,.38);g.add(halo);P.halo=halo;
  g.scale.setScalar(1.05);g.userData.P=P;return shadowize(g);}
function makeKragma(){
  const g=new THREE.Group(),P={};
  const bone=std(0xd8cfc2,{roughness:.55}),flesh=std(0x2a1736,{roughness:.45,metalness:.2,emissive:0x12051c}),purple=std(0x6a3fa8,{roughness:.4,emissive:0x2a1050});
  // root tendrils into the floor
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;const t=new THREE.Mesh(new THREE.ConeGeometry(.35,2.4,7),flesh);t.position.set(Math.cos(a)*1,.5,Math.sin(a)*1);t.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2);g.add(t);}
  const bodyGeo=new THREE.LatheGeometry([[0,0],[1.1,.2],[1.3,1.1],[1.05,2.2],[.95,3],[.6,3.6],[0,3.7]].map(([x,y])=>new THREE.Vector2(x,y)),28);
  const pa=bodyGeo.attributes.position,r=rnd(5);for(let i=0;i<pa.count;i++){const y=pa.getY(i),k=1+.08*Math.sin(y*9)+.05*(r()-.5);pa.setX(i,pa.getX(i)*k);pa.setZ(i,pa.getZ(i)*k);}bodyGeo.computeVertexNormals();
  const body=new THREE.Mesh(bodyGeo,flesh);g.add(body);P.body=body;
  for(let i=0;i<7;i++){const rib=new THREE.Mesh(new THREE.TorusGeometry(1.08-i*.05,.06,6,24,Math.PI*1.1),bone);rib.position.set(0,1.3+i*.3,-.1);rib.rotation.set(Math.PI/2,0,Math.PI*.95);g.add(rib);}
  const core=new THREE.Mesh(new THREE.SphereGeometry(.38,20,16),new THREE.MeshBasicMaterial({color:0xff5a3c}));core.position.set(0,2.2,-1.05);g.add(core);P.core=core;
  const coreL=new THREE.PointLight(0xff4a3a,1.6,6,2);coreL.position.set(0,2.2,-1.6);g.add(coreL);P.coreL=coreL;
  // ornate mask head
  const head=new THREE.Group();head.position.y=4.1;g.add(head);P.head=head;
  const mask=new THREE.Mesh(new THREE.SphereGeometry(.8,24,16,0,Math.PI*2,0,Math.PI*.62),std(0x1c1424,{metalness:.7,roughness:.3,emissive:0x16061e}));mask.scale.set(1,1.2,.8);head.add(mask);
  [-.26,.26].forEach(x=>{const e=new THREE.Mesh(new THREE.BoxGeometry(.26,.06,.05),new THREE.MeshBasicMaterial({color:0xff6a5a}));e.position.set(x,.1,-.64);e.rotation.z=x>0?.25:-.25;head.add(e);});
  for(let i=0;i<13;i++){const a=(i/12-.5)*2.6;const c=new THREE.Mesh(new THREE.ConeGeometry(.08,.6+Math.cos(a)*.7,6),std(0x3b2e48,{metalness:.6,roughness:.35}));c.position.set(Math.sin(a)*.72,.55+Math.cos(a)*.25,Math.cos(a)*-.1);c.rotation.z=-a*.7;head.add(c);}
  const shards=new THREE.Group();shards.position.y=5.3;for(let i=0;i<9;i++){const s=new THREE.Mesh(new THREE.OctahedronGeometry(.16,0),std(0xa77fe4,{emissive:0x5a2a9a}));const a=i/9*Math.PI*2;s.position.set(Math.cos(a)*1.2,0,Math.sin(a)*1.2);s.scale.y=2.4;shards.add(s);}g.add(shards);P.shards=shards;
  // four arms: two big white, two small purple, as segment chains
  P.arms=[];[[45,5.2,bone,.38],[135,3.4,purple,.24],[225,3.4,purple,.24],[315,5.2,bone,.38]].forEach(([h,L,m,rad])=>{const grp=new THREE.Group();g.add(grp);const segs=[];
    for(let k=0;k<14;k++){const rr=rad*(1-k/17);const s=new THREE.Mesh(new THREE.CylinderGeometry(rr*.85,rr,1,8),m);grp.add(s);segs.push(s);}
    const claw=new THREE.Group();for(let c=0;c<3;c++){const cl=new THREE.Mesh(new THREE.ConeGeometry(rad*.25,rad*2.2,5),bone);cl.rotation.z=(c-1)*.5;cl.position.y=rad;claw.add(cl);}grp.add(claw);
    P.arms.push({h,L,segs,claw,m,pts:Array.from({length:15},()=>new THREE.Vector3())});});
  g.userData.P=P;return shadowize(g);}

/* ================= party ================= */
const ROLE=i=>i==3||i==7?'sup':'dd';
/* party labels per language: Д/С (ru), D/S (en), 输/奶 (zh) */
function roleLabel(i){const sup=ROLE(i)=='sup',L=window.LANG||'ru',n=sup?(i==3?1:2):(i<3?i+1:i);return (sup?{ru:'С',en:'S',zh:'奶'}:{ru:'Д',en:'D',zh:'输'})[L]+n;}
function relabel(){party.forEach((p,i)=>{const d=p.userData,old=d.lab;const lab=labelSprite(roleLabel(i),ROLE(i)=='sup'?'#8fd3bf':'#d4a85a');lab.position.y=2.25;p.remove(old);old.material.map.dispose();old.material.dispose();p.add(lab);d.lab=lab;});if(sim)apply();}
(window.__i18nHooks=window.__i18nHooks||[]).push(()=>{if(partyReady)relabel();});
function labelSprite(txt,col){const c=document.createElement('canvas');c.width=256;c.height=96;const g=c.getContext('2d');g.font='700 44px "Golos Text", sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.fillStyle='rgba(10,8,14,.72)';const w=g.measureText(txt).width+34;g.beginPath();g.roundRect?g.roundRect(128-w/2,18,w,60,30):g.rect(128-w/2,18,w,60);g.fill();g.strokeStyle=col;g.lineWidth=3;g.stroke();g.fillStyle=col;g.fillText(txt,128,50);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(1.3,.49,1);s.renderOrder=10;return s;}
function partyMember(i,model){
  const g=new THREE.Group(),sup=ROLE(i)=='sup',col=sup?0x8fd3bf:0xd4a85a;
  let body,mixer=null,acts=null,bones=null;
  if(model){body=THREE.SkeletonUtils.clone(model.scene);body.traverse(m=>{if(m.isMesh){m.castShadow=true;m.material=m.material.clone();m.material.color.multiply(new THREE.Color(sup?0x9ad8c8:0xe8d8c0));}});
    body.scale.setScalar(model.scale);body.rotation.y=Math.PI;g.add(body);
    mixer=new THREE.AnimationMixer(body);acts={};model.anims.forEach(a=>{acts[a.name]=mixer.clipAction(a);});['Idle','Walk','Run'].forEach(n=>{if(acts[n]){acts[n].play();acts[n].setEffectiveWeight(n=='Idle'?1:0);}});
    mixer.update(Math.random()*2);
    const bn={};body.traverse(o=>{const k=o.isBone&&/(Left|Right)(Arm|ForeArm|Hand)$/.exec(o.name);if(k)bn[k[1]+k[2]]=o;});
    if(bn.LeftArm&&bn.LeftForeArm&&bn.LeftHand&&bn.RightArm&&bn.RightForeArm&&bn.RightHand)bones=[[bn.LeftArm,bn.LeftForeArm,bn.LeftHand],[bn.RightArm,bn.RightForeArm,bn.RightHand]];}
  else{body=new THREE.Group();const m=std(col,{roughness:.45});const b=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,.9,12),m);b.position.y=.6;body.add(b);const h=new THREE.Mesh(new THREE.SphereGeometry(.19,14,10),m);h.position.y=1.2;body.add(h);shadowize(body);g.add(body);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.36,.46,32),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.85,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;g.add(ring);
  const lab=labelSprite(roleLabel(i),sup?'#8fd3bf':'#d4a85a');lab.position.y=2.25;g.add(lab);
  g.userData={i,mixer,acts,bones,ring,lab,col,prev:new THREE.Vector3(),speed:0,w:{Idle:1,Walk:0,Run:0},gw:0,gTarget:0};
  return g;}
function buildParty(model){party.forEach(p=>scene.remove(p));party=[];for(let i=0;i<8;i++){const p=partyMember(i,model);scene.add(p);party.push(p);}partyReady=true;if(sim)apply();}
function loadModel(){
  if(!(THREE.GLTFLoader&&THREE.SkeletonUtils&&window.SOLDIER_GLB)){buildParty(null);return;}
  try{const bin=Uint8Array.from(atob(window.SOLDIER_GLB),c=>c.charCodeAt(0)).buffer;
    new THREE.GLTFLoader().parse(bin,'',gl=>{const box=new THREE.Box3().setFromObject(gl.scene),h=box.max.y-box.min.y||1.8;buildParty({scene:gl.scene,anims:gl.animations,scale:1.75/h});},e=>{console.warn('model',e);buildParty(null);});}
  catch(e){console.warn(e);buildParty(null);}}

/* ================= GLB bosses & arenas (built in nnew/models, embedded as js/glb/*.js) =================
   Loaded per gate on first use; the procedural boss/arena above stays as the fallback until (or unless) the GLB loads.
   Boss clips: the clip named after the sim key (same duration) plays in sync with T; otherwise the sim's actions map to
   the capitalised action clips (Swing, Slam, …), otherwise Idle. Arena 2's outer/mid floor chunks fall with 'void' rings. */
const GLBV=2,glbP={},glbReq={};
function glbData(key){return new Promise((res,rej)=>{const D=window.GLB_DATA||{};if(D[key])return res(D[key]);
  const s=document.createElement('script');s.src='js/glb/'+key+'.js?v='+GLBV;s.async=true;
  s.onload=()=>{const d=(window.GLB_DATA||{})[key];d?res(d):rej(new Error('empty '+key));};s.onerror=()=>rej(new Error('missing '+key));document.head.appendChild(s);});}
function glbLoad(key){return glbP[key]||(glbP[key]=glbData(key).then(b64=>{const str=atob(b64),u=new Uint8Array(str.length);for(let i=0;i<str.length;i++)u[i]=str.charCodeAt(i);
  delete window.GLB_DATA[key];return new Promise((res,rej)=>new THREE.GLTFLoader().parse(u.buffer,'',res,rej));}));}
function glbBoss(B,gl){const m=gl.scene;B.children.forEach(c=>c.visible=false);m.rotation.y=Math.PI;m.scale.setScalar(1/B.scale.x);
  m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});B.add(m);
  const mixer=new THREE.AnimationMixer(m),C={};gl.animations.forEach(a=>{const ac=mixer.clipAction(a);ac.play();ac.paused=true;ac.setEffectiveWeight(0);C[a.name]=ac;});
  B.userData.glb={mixer,C};if(sim)apply();}
function glbPose(B,t){const {mixer,C}=B.userData.glb;let n='Idle',ct=C.Idle?t%C.Idle.getClip().duration:0;
  if(C[simKey]){n=simKey;ct=Math.min(t,C[n].getClip().duration-1e-3);}
  else sim.act.forEach(([s0,a,d])=>{const k=a[0].toUpperCase()+a.slice(1);if(t>=s0&&t<=s0+d&&C[k]){n=k;ct=(t-s0)/d*C[k].getClip().duration;}});
  for(const k in C){C[k].setEffectiveWeight(k==n?1:0);if(k==n)C[k].time=ct;}mixer.update(0);}
function glbArena(E,gl,g2){const keep=new Set([...(E.userData.shafts||[]),...(g2?E.userData.fog||[]:fogLayers)]);
  E.children.forEach(c=>{if(!c.isLight&&!keep.has(c))c.visible=false;});
  const a=gl.scene,chunks=[];a.traverse(o=>{if(!o.isMesh)return;const top=o.parent&&o.parent!==a?o.parent:o;
    o.receiveShadow=/^(platform|inlays|core|mid_|outer_)/.test(top.name);o.castShadow=false;if(/^(sky|void)$/.test(top.name))o.material.fog=false;});
  a.children.forEach(o=>{const mm=/^(mid|outer)_/.exec(o.name);if(mm)chunks.push({o,r0:mm[1]=='mid'?6:8,y:o.position.y});});
  E.add(a);E.userData.glb=a;E.userData.chunks=chunks;if(sim&&(sim.g==2)==g2){floorMesh.visible=false;apply();}}
function glbGate(g2){const k=g2?'B':'A';if(glbReq[k]||!THREE.GLTFLoader)return;glbReq[k]=1;
  glbLoad(g2?'kragma':'belgardin').then(gl=>glbBoss(g2?bossB:bossA,gl)).catch(e=>console.warn('boss glb',e));
  glbLoad(g2?'arena2':'arena1').then(gl=>glbArena(g2?envB:envA,gl,g2)).catch(e=>console.warn('arena glb',e));}
function glbCollapse(E,t){if(!E.userData.chunks)return;const vs=objs.filter(o=>o.it.k=='void'&&o.it.ring&&t>=o.it.t0);
  E.userData.chunks.forEach(c=>{const v=vs.find(o=>c.r0>=(o.it.r0||0)-.01);const p=v?Math.min(1,(t-v.it.t0)/1.6):0;c.o.position.y=c.y-p*p*16;c.o.visible=p<1;});}

/* ================= init ================= */
function init(){
  if(!window.THREE){$('#simCap').textContent='three.js не загрузился — 3D-схема недоступна, остальная памятка работает.';return false;}
  R=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=.9;
  R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x111017,.02);
  cam=new THREE.PerspectiveCamera(42,1,.1,400);DOT=dotTex();
  const hemi=new THREE.HemisphereLight(0x9a98c0,0x140e0a,.42);scene.add(hemi);scene.userData.hemi=hemi;
  const moon=new THREE.DirectionalLight(0xc9d2ff,1.05);moon.position.set(-9,18,-12);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:50});moon.shadow.bias=-.0006;moon.shadow.normalBias=.02;scene.add(moon);scene.userData.moon=moon;
  const fill=new THREE.DirectionalLight(0x9fb0ff,.55);fill.position.set(6,9,14);scene.add(fill);scene.userData.fill=fill;
  const rimL=new THREE.DirectionalLight(0xffffff,0);rimL.position.set(0,6,-16);scene.add(rimL);scene.userData.rim=rimL;
  FLASH=Array.from({length:5},()=>{const l=new THREE.PointLight(0xffffff,0,13,2);l.position.y=1.2;scene.add(l);l.userData.v=0;return l;});
  const A=floorMaps(0),B=floorMapsB();
  floorA=std(0xffffff,{map:A.map,bumpMap:A.bump,bumpScale:.06,roughness:.9,emissive:0xffffff,emissiveMap:A.emi,emissiveIntensity:.4});
  floorB=std(0xffffff,{map:B.map,bumpMap:B.bump,bumpScale:.14,roughness:.86,metalness:.04,emissive:0xffffff,emissiveMap:B.emi,emissiveIntensity:.55});
  floorMesh=new THREE.Mesh(new THREE.CircleGeometry(10.5,128),floorA);floorMesh.rotation.x=-Math.PI/2;floorMesh.receiveShadow=true;scene.add(floorMesh);
  const ct=new THREE.MeshBasicMaterial({map:clockTex(0),transparent:true,depthWrite:false}),ct2=new THREE.MeshBasicMaterial({map:clockTex(1),transparent:true,depthWrite:false});
  clockA=new THREE.Mesh(new THREE.CircleGeometry(10.5,64),ct);clockA.rotation.x=-Math.PI/2;clockA.position.y=.012;scene.add(clockA);
  clockB=new THREE.Mesh(new THREE.CircleGeometry(10.5,64),ct2);clockB.rotation.x=-Math.PI/2;clockB.position.y=.012;scene.add(clockB);
  envA=makeEnvA();envB=makeEnvB();scene.add(envA,envB);
  bossA=makeBelgardin();bossB=makeKragma();scene.add(bossA,bossB);
  arrow=new THREE.Group();const ac=new THREE.Mesh(new THREE.ConeGeometry(.32,.9,3),new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.9,depthWrite:false}));ac.rotation.x=-Math.PI/2;arrow.add(ac);scene.add(arrow);
  // ash + souls
  const N=500,pos=new Float32Array(N*3);for(let i=0;i<N;i++){pos[i*3]=(Math.random()-.5)*44;pos[i*3+1]=Math.random()*14;pos[i*3+2]=(Math.random()-.5)*44;}
  const ag=new THREE.BufferGeometry();ag.setAttribute('position',new THREE.BufferAttribute(pos,3));
  ash=new THREE.Points(ag,new THREE.PointsMaterial({map:DOT,color:0x9a94a8,size:.08,transparent:true,opacity:.45,depthWrite:false}));scene.add(ash);
  const S=160,sp=new Float32Array(S*3);for(let i=0;i<S;i++){const a=Math.random()*7,r=Math.random()*11;sp[i*3]=Math.sin(a)*r;sp[i*3+1]=Math.random()*9;sp[i*3+2]=Math.cos(a)*r;}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  souls=new THREE.Points(sg,new THREE.PointsMaterial({map:DOT,color:0x8fd3bf,size:.26,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(souls);
  // drifting black ash blobs (as in the cutscenes)
  const NB=70,bp=new Float32Array(NB*3);for(let i=0;i<NB;i++){bp[i*3]=(Math.random()-.5)*40;bp[i*3+1]=1+Math.random()*12;bp[i*3+2]=(Math.random()-.5)*40;}
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(bp,3));
  blobs=new THREE.Points(bg,new THREE.PointsMaterial({map:DOT,color:0x050307,size:.55,transparent:true,opacity:.8,depthWrite:false}));scene.add(blobs);
  // boss glow light, wisps around the bosses, trails circling each arena
  const bl=new THREE.PointLight(0xa36bff,1.6,16,2);scene.add(bl);scene.userData.bossL=bl;
  auraA=makeAura(0x9a5cff);auraB=makeAura(0xff3a4a);scene.add(auraA,auraB);
  ribA=makeRibbons(0x8a4dff,7,11);ribB=makeRibbons(0xff2f5a,6,23);scene.add(ribA,ribB);
  // JG badge
  gTexr=new THREE.CanvasTexture(gCan);gTexr.encoding=THREE.sRGBEncoding;drawG(false,0);
  gMark=new THREE.Sprite(new THREE.SpriteMaterial({map:gTexr,depthTest:false,transparent:true}));gMark.scale.set(.95,.95,1);gMark.renderOrder=11;gMark.visible=false;scene.add(gMark);
  setupPost();
  bindInput();resize();new ResizeObserver(resize).observe(canvas);
  if('IntersectionObserver' in window)new IntersectionObserver(e=>{visible=e[0].isIntersecting},{threshold:0}).observe(canvas);
  loadModel();
  return true;}
/* post: HDR render → bloom → grade pass (ACES + sRGB done here, since r128 skips both on render targets) with vignette,
   slight chromatic fringe and grain. Without the example scripts the renderer's own tone mapping is used. */
const GRADE_SHADER={uniforms:{tDiffuse:{value:null},uExp:{value:1},uT:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform sampler2D tDiffuse;uniform float uExp,uT;varying vec2 vUv;'+
  'vec3 rrt(vec3 v){vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return a/b;}'+
  'vec3 aces(vec3 c){const mat3 I=mat3(.59719,.07600,.02840,.35458,.90834,.13383,.04823,.01566,.83777);const mat3 O=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602);c=I*(c/.6);c=rrt(c);return clamp(O*c,0.,1.);}'+
  'vec3 srgb(vec3 c){return mix(pow(c,vec3(.41666))*1.055-.055,c*12.92,vec3(lessThanEqual(c,vec3(.0031308))));}'+
  'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}'+
  'void main(){vec2 c=vUv-.5;float ca=dot(c,c)*.008;vec3 col=vec3(texture2D(tDiffuse,vUv-c*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv+c*ca).b);'+
  'col=aces(col*uExp);float l=dot(col,vec3(.2126,.7152,.0722));col=mix(col,col*vec3(.92,.95,1.1),(1.-l)*.35);col=srgb(col);'+
  'float v=smoothstep(.9,.25,length(c*vec2(1.,.9)));col*=mix(.55,1.,v);col+=(h(vUv*vec2(1311.,977.)+fract(uT))-.5)*.022;gl_FragColor=vec4(col,1.);}'};
function setupPost(){
  if(!(THREE.EffectComposer&&THREE.RenderPass&&THREE.UnrealBloomPass&&THREE.ShaderPass)||/nopost/.test(location.search))return;
  try{const pr=R.getPixelRatio(),w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),o={type:THREE.HalfFloatType,format:THREE.RGBAFormat};
    let rt;if(R.capabilities.isWebGL2&&THREE.WebGLMultisampleRenderTarget){rt=new THREE.WebGLMultisampleRenderTarget(w*pr,h*pr,o);rt.samples=4;}else rt=new THREE.WebGLRenderTarget(w*pr,h*pr,o);
    composer=new THREE.EffectComposer(R,rt);composer.addPass(new THREE.RenderPass(scene,cam));
    bloom=new THREE.UnrealBloomPass(new THREE.Vector2(w,h),.55,.42,.78);composer.addPass(bloom);
    GRADE=new THREE.ShaderPass(GRADE_SHADER);composer.addPass(GRADE);R.toneMapping=THREE.NoToneMapping;}
  catch(e){console.warn('post',e);composer=null;GRADE=null;R.toneMapping=THREE.ACESFilmicToneMapping;}}
function draw(){if(composer){GRADE.uniforms.uExp.value=R.toneMappingExposure;GRADE.uniforms.uT.value=performance.now()/1000;composer.render();}else R.render(scene,cam);}
function resize(){if(!R)return;const w=canvas.clientWidth,h=canvas.clientHeight;R.setSize(w,h,false);if(composer){composer.setSize(w,h);}cam.aspect=w/h;cam.updateProjectionMatrix();if(camMode=='orbit'&&!sim?.cam)dist=w<520?28:23;}

/* ================= sim objects ================= */
function sectorGeo(r0,r1,h,arc){return new THREE.RingGeometry(Math.max(r0,.001),r1,Math.max(12,Math.round(arc/2.5)),1,(90-h-arc/2)*deg,arc*deg);}
function clearSim(){objs.forEach(o=>{scene.remove(o.m);o.m.traverse(x=>{x.geometry&&x.geometry.dispose();if(x.material&&x.material.dispose&&!x.material.userData.keep)x.material.dispose();});});objs=[];fx.forEach(f=>scene.remove(f.m));fx=[];vfx.forEach(v=>scene.remove(v.m));vfx=[];FLASH.forEach(l=>{l.userData.v=0;l.intensity=0;});shocks.forEach(s=>scene.remove(s));shocks=[];}
function itemCenter(it){if(it.k=='sector'){if(it.arc>=360)return[it.cx,it.cz];const p=dir(it.h,(it.r0+it.r1)/2);return[it.cx+p[0],it.cz+p[1]];}if(it.k=='band')return[it.cx,it.cz];if(it.k=='disc')return[it.x,it.z];return[it.x||0,it.z||0];}
const coffinShape=(()=>{const cs=new THREE.Shape();cs.moveTo(0,1.45);cs.lineTo(.62,1.0);cs.lineTo(.5,-1.45);cs.lineTo(-.5,-1.45);cs.lineTo(-.62,1.0);cs.closePath();return cs;})();
function makeCoffin(red){const m=new THREE.Group();const gg=new THREE.ExtrudeGeometry(coffinShape,{depth:.7,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:2});gg.center();
  const b=new THREE.Mesh(gg,std(red?0x3a1410:0x2a2228,{roughness:.55,metalness:.3,emissive:red?0x5a0f08:0x07040a}));b.rotation.x=-Math.PI/2;b.position.y=.42;m.add(b);
  const lm=new THREE.MeshBasicMaterial({color:red?0xff5a3c:0xb08a46});const l=new THREE.Mesh(new THREE.BoxGeometry(.1,.05,2.6),lm);l.position.y=.82;m.add(l);const l2=new THREE.Mesh(new THREE.BoxGeometry(.7,.05,.1),lm);l2.position.set(0,.82,-.5);m.add(l2);
  return shadowize(m);}
function makeCultist(s){const m=new THREE.Group();const robe=new THREE.Mesh(new THREE.ConeGeometry(.5*s,1.8*s,12),std(0x3a1d2c,{roughness:.9,emissive:0x1a0610}));robe.position.y=.9*s;m.add(robe);
  const hood=new THREE.Mesh(new THREE.ConeGeometry(.26*s,.5*s,10),std(0x2a121f,{roughness:.9}));hood.position.y=1.95*s;m.add(hood);
  const face=new THREE.Mesh(new THREE.SphereGeometry(.12*s,8,6),new THREE.MeshBasicMaterial({color:0xff6a4a}));face.position.set(0,1.82*s,-.16*s);m.add(face);
  const r=new THREE.Mesh(new THREE.RingGeometry(.65*s,.8*s,32),new THREE.MeshBasicMaterial({color:0xdc5841,side:THREE.DoubleSide,transparent:true,opacity:.8}));r.rotation.x=-Math.PI/2;r.position.y=.05;m.add(r);return shadowize(m);}
function ghost(){const g=new THREE.Group();const m=new THREE.MeshStandardMaterial({color:0x8fd3bf,transparent:true,opacity:.38,emissive:0x2a6a5a,depthWrite:false});
  const b=new THREE.Mesh(new THREE.ConeGeometry(1.1,3.4,18,1,true),m);b.position.y=1.7;g.add(b);const h=new THREE.Mesh(new THREE.SphereGeometry(.38,14,10),m);h.position.y=3.6;g.add(h);
  const w=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.6),m);w.position.set(0,2.9,.3);g.add(w);return g;}
/* ================= clip-derived effects (patterns read from the Inven / Arca clips) ================= */
const FXC={};
function fxTex(key,fn){if(!FXC[key]){FXC[key]=cTex(512,512,fn);}return FXC[key];}
/* swirl ring: the in-game JG / co-op cue around the boss */
function swirlTex(){return fxTex('swirl',(g,s)=>{const c=s/2,r=rnd(17);g.lineCap='round';
  for(let i=0;i<16;i++){const r0=170+r()*70,a0=r()*Math.PI*2,len=.7+r()*1.8,w=3+r()*13;g.strokeStyle=`rgba(255,255,255,${.3+r()*.6})`;g.lineWidth=w;g.beginPath();
    for(let k=0;k<=30;k++){const u=k/30,a=a0+u*len,rr=r0+Math.sin(u*Math.PI)*22*(i%2?1:-1);const x=c+Math.cos(a)*rr,y=c+Math.sin(a)*rr;k?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
  const gr=g.createRadialGradient(c,c,150,c,c,250);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.65,'rgba(255,255,255,.22)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);});}
/* vertical light pillar */
function pillarTex(){return fxTex('pillar',(g,s)=>{const gr=g.createLinearGradient(0,s,0,0);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.75)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);
  const r=rnd(5);g.globalCompositeOperation='destination-out';for(let i=0;i<40;i++){g.fillStyle=`rgba(0,0,0,${r()*.6})`;g.fillRect(r()*s,0,2+r()*10,s);}});}
/* floor decals: tendrils (imprison roots), cracks (five-step), chevron fill (blade insight) */
function decalTex(pat,seed){return fxTex(pat+seed,(g,s)=>{const c=s/2,r=rnd(seed||3);g.lineCap='round';g.lineJoin='round';
  if(pat=='chevron'){g.fillStyle='rgba(255,255,255,.55)';g.fillRect(0,0,s,s);g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=5;for(let y=-s;y<s*2;y+=26){g.beginPath();for(let x=0;x<=s;x+=26){g.lineTo(x,y+((x/26)%2?13:0));}g.stroke();}
    g.globalCompositeOperation='destination-in';const gr=g.createRadialGradient(c,c,0,c,c,c);gr.addColorStop(0,'#fff');gr.addColorStop(.9,'#fff');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);return;}
  const n=pat=='roots'?16:11;
  const branch=(x,y,a,len,w,d)=>{g.lineWidth=w;g.strokeStyle=`rgba(255,255,255,${.95-d*.2})`;g.beginPath();g.moveTo(x,y);const st=pat=='roots'?14:22;
    for(let l=0;l<len;l+=st){a+=(r()-.5)*(pat=='roots'?.35:.9);x+=Math.cos(a)*st;y+=Math.sin(a)*st;g.lineTo(x,y);
      if(d<2&&r()<(pat=='roots'?.12:.08)){g.stroke();branch(x,y,a+(r()-.5)*1.4,(len-l)*.5,w*.6,d+1);g.lineWidth=w;g.strokeStyle=`rgba(255,255,255,${.95-d*.2})`;g.beginPath();g.moveTo(x,y);}
      if(Math.hypot(x-c,y-c)>c-4)break;}g.stroke();};
  g.shadowColor='#fff';g.shadowBlur=pat=='roots'?10:6;
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2+r()*.3;branch(c+Math.cos(a)*18,c+Math.sin(a)*18,a,c*.98,pat=='roots'?6:4,0);}});}
const DECAL_F='uniform sampler2D uMap;uniform vec3 uC;uniform float uP,uA;varying vec2 vUv;void main(){vec4 t=texture2D(uMap,vUv);float d=length(vUv-.5)*2.;float rev=smoothstep(uP,uP-.06,d);float front=smoothstep(.06,0.,abs(d-uP))*step(uP,.99);gl_FragColor=vec4(uC*(1.2+front*2.),t.a*max(rev,front)*uA);}';
const MIST_F='uniform vec3 uC;uniform float uA,uT;varying vec2 vUv;'+NOISE+'void main(){vec2 p=(vUv-.5)*2.;float d=length(p);float a=atan(p.y,p.x);float n=fbm(vec2(a*1.6+uT*.25,d*3.-uT*.5))*.7+fbm(p*3.+uT*.1)*.5;float m=smoothstep(.35,.95,n)*smoothstep(1.,.8,d);gl_FragColor=vec4(uC*(.8+n*.8),m*uA);}';
const FXV='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const addMat=(col,o)=>new THREE.MeshBasicMaterial(Object.assign({color:col,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide},o||{}));
function makeCue(it){const m=new THREE.Group(),col=it.kind=='jg'?0xff9a10:0x3f8cff;
  const sw=new THREE.Mesh(new THREE.PlaneGeometry(2.3,2.3),addMat(col,{map:swirlTex(),blending:THREE.NormalBlending}));sw.rotation.x=-Math.PI/2;sw.position.y=.12;m.add(sw);
  const sw2=sw.clone();sw2.material=sw.material.clone();sw2.position.y=.5;sw2.scale.setScalar(.85);m.add(sw2);
  const tr=new THREE.Mesh(new THREE.RingGeometry(.96,1,96),addMat(it.kind=='jg'?0xfff0c8:0xd6e6ff));tr.rotation.x=-Math.PI/2;tr.position.y=.14;m.add(tr);
  m.position.set(it.x,0,it.z);m.userData={sw,sw2,tr};return m;}
function makePillar(it){const m=new THREE.Group(),h=it.h||9,col=it.col!=null?it.col:0xf4ecff;
  const outer=new THREE.Mesh(new THREE.CylinderGeometry(it.r,it.r*1.1,h,24,1,true),addMat(col,{map:pillarTex(),opacity:.85}));outer.position.y=h/2;m.add(outer);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(it.r*.35,it.r*.45,h,12,1,true),addMat(0xffffff,{map:pillarTex()}));core.position.y=h/2;m.add(core);
  const base=new THREE.Mesh(new THREE.CircleGeometry(it.r*1.6,32),addMat(col,{map:DOT}));base.rotation.x=-Math.PI/2;base.position.y=.08;m.add(base);
  m.position.set(it.x,0,it.z);return m;}
function makeSigil(it){const m=new THREE.Group(),mat=addMat(0xb98cff,{opacity:.9}),R=it.r||3.5;
  for(let i=0;i<3;i++){const a=i*120*deg,b=(i+1)*120*deg,A=[Math.sin(a)*R,-Math.cos(a)*R],B=[Math.sin(b)*R,-Math.cos(b)*R],L=Math.hypot(B[0]-A[0],B[1]-A[1]);
    const e=new THREE.Mesh(new THREE.PlaneGeometry(.12,L),mat);e.rotation.x=-Math.PI/2;e.rotation.z=-Math.atan2(B[0]-A[0],-(B[1]-A[1]));e.position.set((A[0]+B[0])/2,.1,(A[1]+B[1])/2);
    const holder=new THREE.Group();holder.add(e);m.add(holder);
    const c=new THREE.Mesh(new THREE.RingGeometry(.55,.68,40),mat);c.rotation.x=-Math.PI/2;c.position.set(A[0],.1,A[1]);m.add(c);
    const c2=new THREE.Mesh(new THREE.RingGeometry(.25,.32,24),mat);c2.rotation.x=-Math.PI/2;c2.position.set(A[0],.1,A[1]);m.add(c2);}
  const o=new THREE.Mesh(new THREE.RingGeometry(R*1.02,R*1.06,96),mat);o.rotation.x=-Math.PI/2;o.position.y=.1;m.add(o);
  const gl=new THREE.Mesh(new THREE.CircleGeometry(R*1.1,48),addMat(0x7a40d0,{map:DOT,opacity:.5}));gl.rotation.x=-Math.PI/2;gl.position.y=.06;m.add(gl);return m;}
function makeBlade(){const m=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0x8fd0ff});
  const t=new THREE.Mesh(new THREE.TorusGeometry(.6,.07,8,40),mat);t.rotation.x=Math.PI/2;m.add(t);
  for(let i=0;i<6;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.12,.55,4),mat),a=i/6*Math.PI*2;c.position.set(Math.cos(a)*.78,0,Math.sin(a)*.78);c.rotation.set(Math.PI/2,0,-a+Math.PI/2+.5);m.add(c);}
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:DOT,color:0x4aa8ff,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(3,3,1);m.add(sp);
  const sh=new THREE.Mesh(new THREE.RingGeometry(1.4,1.9,40),addMat(0x4aa8ff,{opacity:.55}));sh.rotation.x=-Math.PI/2;sh.position.y=-.8;m.add(sh);m.userData.sh=sh;return m;}
function makeDecal(it){const m=new THREE.Mesh(new THREE.PlaneGeometry(it.r*2,it.r*2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{uMap:{value:decalTex(it.pat,it.seed||3)},uC:{value:new THREE.Color(it.col!=null?it.col:0xf4f0ff)},uP:{value:0},uA:{value:0}},vertexShader:FXV,fragmentShader:DECAL_F}));
  m.rotation.order='YXZ';m.rotation.y=-(it.h||0)*deg;m.rotation.x=-Math.PI/2;m.position.set(it.x||0,.09,it.z||0);return m;}
function makeMist(it){const m=new THREE.Mesh(new THREE.PlaneGeometry(it.r*2,it.r*2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{uC:{value:new THREE.Color(it.col)},uA:{value:0},uT:{value:0}},vertexShader:FXV,fragmentShader:MIST_F}));m.rotation.x=-Math.PI/2;m.position.set(it.x||0,.35,it.z||0);return m;}
function makeBeam(it){const m=new THREE.Group(),dx=it.x2-it.x1,dz=it.z2-it.z1,L=Math.hypot(dx,dz),col=it.col!=null?it.col:0xff3a2a;
  const glow=new THREE.Mesh(new THREE.CylinderGeometry(1,1,L,20,1,true),addMat(col,{opacity:.35}));glow.rotation.x=Math.PI/2;m.add(glow);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,L,12,1,true),addMat(0xffffff,{opacity:.9}));core.rotation.x=Math.PI/2;m.add(core);
  const aim=new THREE.Mesh(new THREE.PlaneGeometry(.08,L),addMat(col));aim.rotation.x=-Math.PI/2;aim.position.y=-.9;m.add(aim);
  m.position.set((it.x1+it.x2)/2,1,(it.z1+it.z2)/2);m.rotation.y=Math.atan2(dx,dz);m.userData={glow,core,aim,w:(it.w||2)/2};return m;}
function makePortal(it){const m=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(1.25,.34,10,36),std(0x1b1820,{roughness:.85,metalness:.2,emissive:0x05080a}));m.add(ring);
  const inner=new THREE.Mesh(new THREE.CircleGeometry(1.0,36),it.dark?new THREE.MeshBasicMaterial({color:0x040406}):addMat(0x34d6e0,{map:swirlTex(),opacity:.95}));m.add(inner);
  if(!it.dark){const back=new THREE.Mesh(new THREE.CircleGeometry(1.0,36),new THREE.MeshBasicMaterial({color:0x06262a}));back.position.z=-.02;m.add(back);}
  m.position.set(it.x,1.45,it.z);m.lookAt(0,1.2,0);m.rotateX(-.35);m.userData.inner=inner;return shadowize(m);}
function makeFlesh(){const m=new THREE.Group();const g=new THREE.SphereGeometry(1.5,32,24),p=g.attributes.position,r=rnd(9);
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),n=1+(Math.sin(v.x*4.1)*Math.sin(v.y*3.7)*Math.sin(v.z*4.4))*.06+(r()-.5)*.03;v.multiplyScalar(n);p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();
  const b=new THREE.Mesh(g,std(0x2e0408,{roughness:.6,metalness:.0,emissive:0x140103}));b.position.y=1.5;m.add(b);
  const s=new THREE.Mesh(new THREE.RingGeometry(.45,.62,32),new THREE.MeshBasicMaterial({color:0xff9a3a,side:THREE.DoubleSide}));s.position.set(0,1.5,1.52);m.add(s);
  const s2=new THREE.Mesh(new THREE.CircleGeometry(.22,20),new THREE.MeshBasicMaterial({color:0xffc070,side:THREE.DoubleSide}));s2.position.set(0,1.5,1.53);m.add(s2);
  return shadowize(m);}
function makeSpine(len,col){const m=new THREE.Group(),n=Math.max(6,Math.round(len/.42)),bone=std(col,{roughness:.55,emissive:col,emissiveIntensity:.12});
  for(let i=0;i<n;i++){const u=i/(n-1),rr=.34-u*.22,z=-(.6+u*(len-.6));const v=new THREE.Mesh(new THREE.SphereGeometry(rr,8,6),bone);v.scale.set(1,.7,1.2);v.position.set(0,.22+rr*.4,z);m.add(v);
    if(i%2==0&&u<.85){[-1,1].forEach(sd=>{const rib=new THREE.Mesh(new THREE.ConeGeometry(.05,rr*2.6,5),bone);rib.position.set(sd*rr*1.3,.25,z);rib.rotation.z=sd*1.2;m.add(rib);});}}
  return shadowize(m);}
function makeSpears(){const m=new THREE.Group(),bone=std(0xd8cbb0,{roughness:.5,emissive:0x40382a});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,14,8),bone);beam.rotation.x=Math.PI/2;beam.position.y=.35;m.add(beam);
  for(let i=0;i<11;i++){const z=-6.5+i*1.3,h=1.6+((i*7)%3)*.35;const sp=new THREE.Mesh(new THREE.ConeGeometry(.16,h,6),bone);sp.position.set(0,.35+h/2,z);sp.rotation.x=(i%2?.18:-.18);m.add(sp);
    [-1,1].forEach(sd=>{const pr=new THREE.Mesh(new THREE.ConeGeometry(.08,.7,5),bone);pr.position.set(sd*.28,.35+h*.75,z);pr.rotation.z=sd*.5;m.add(pr);});}
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.6,14.4),addMat(0x7a4ad8,{opacity:.4}));gl.rotation.x=-Math.PI/2;gl.position.y=.06;m.add(gl);return shadowize(m);}
function makeTwister(it){const m=new THREE.Group(),mat=addMat(it.col!=null?it.col:0x6ab8ff,{opacity:.28,map:swirlTex()});
  for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.7+i*.45,.25+i*.15,3.5+i,24,1,true),mat);c.position.y=1.8+i*.4;m.add(c);}return m;}
/* ================= boss casting circles, blade arcs, lightning, aura, ribbons ================= */
/* ritual circle under the boss while it casts: pentagram (gate I) / hexagram (gate II), runes, nodes */
function circleTex(g2){return fxTex('circle'+(g2?2:1),(g,s)=>{const c=s/2,P=(a,r)=>[c+Math.sin(a)*r,c-Math.cos(a)*r];g.strokeStyle=g.fillStyle='#fff';g.shadowColor='#fff';g.shadowBlur=5;
  const ring=(r,w)=>{g.lineWidth=w;g.beginPath();g.arc(c,c,r,0,7);g.stroke();};ring(250,5);ring(240,1.5);ring(200,3.5);ring(126,2);ring(58,3);ring(44,1.5);
  for(let i=0;i<96;i++){const a=i/96*Math.PI*2,[x0,y0]=P(a,i%4?243:237),[x1,y1]=P(a,249);g.lineWidth=i%4?1.5:3;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
  g.font='600 21px serif';g.textAlign='center';g.textBaseline='middle';const runes='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for(let i=0;i<36;i++){const a=i/36*Math.PI*2,[x,y]=P(a,220);g.save();g.translate(x,y);g.rotate(a);g.fillText(runes[(i*7)%runes.length],0,0);g.restore();}
  const n=g2?6:5,R0=200;g.lineWidth=4;g.lineJoin='miter';
  if(g2)[0,1].forEach(o=>{g.beginPath();for(let i=0;i<=3;i++){const [x,y]=P((i*2+o)/6*Math.PI*2,R0);i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();});
  else{g.beginPath();for(let i=0;i<=5;i++){const [x,y]=P((i*2%5)/5*Math.PI*2,R0);i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
  for(let i=0;i<n;i++){const [x,y]=P(i/n*Math.PI*2+Math.PI/n,140);g.lineWidth=2;g.beginPath();g.arc(x,y,14,0,7);g.stroke();g.beginPath();g.arc(x,y,4,0,7);g.fill();}
  for(let i=0;i<n;i++){const [x,y]=P(i/n*Math.PI*2,R0);g.lineWidth=3;g.beginPath();g.arc(x,y,17,0,7);g.stroke();g.beginPath();g.arc(x,y,6,0,7);g.fill();}});}
const hdr=(hex,k)=>new THREE.Color(hex).multiplyScalar(k);
function makeCircle(g2){const m=new THREE.Group(),col=g2?0xff3a5a:0xa36bff;
  const a=new THREE.Mesh(new THREE.PlaneGeometry(2,2),addMat(hdr(col,2.2),{map:circleTex(g2),opacity:0}));a.rotation.x=-Math.PI/2;m.add(a);
  const b=new THREE.Mesh(new THREE.PlaneGeometry(2,2),addMat(hdr(col,1.4),{map:swirlTex(),opacity:0}));b.rotation.x=-Math.PI/2;b.position.y=.02;m.add(b);
  const gl=new THREE.Mesh(new THREE.CircleGeometry(1.2,40),addMat(hdr(col,.8),{map:DOT,opacity:0}));gl.rotation.x=-Math.PI/2;gl.position.y=-.01;m.add(gl);
  m.userData={a,b,gl};return m;}
/* blade arc: a crescent that sweeps around the boss, white-hot rim and a fading trail */
const SLASH_F='uniform vec3 uC;uniform float uP,uA,uR0,uR1,uS,uL;varying vec2 vP;void main(){float r=clamp((length(vP)-uR0)/(uR1-uR0),0.,1.);float u=(atan(vP.y,vP.x)-uS)/uL;'+
  'float tr=smoothstep(uP-.6,uP,u)*step(u,uP);float rim=smoothstep(.72,.97,r)*smoothstep(1.,.97,r);float body=pow(r,2.4);float a=tr*(body*.55+rim)*uA;'+
  'gl_FragColor=vec4(mix(uC,vec3(1.),rim)*(1.+rim*3.2),a);}';
function makeSlash(g2,big){const m=new THREE.Group(),R0=big?1.4:1.1,R1=big?7:5.6,L=Math.PI*.95,S=Math.PI/2-L/2;
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,vertexShader:TV,fragmentShader:SLASH_F,
    uniforms:{uC:{value:hdr(g2?0xff9a8a:0xc9b8ff,1.3)},uP:{value:0},uA:{value:0},uR0:{value:R0},uR1:{value:R1},uS:{value:S},uL:{value:L}}});
  const s=new THREE.Mesh(new THREE.RingGeometry(R0,R1,64,1,S,L),mat);s.rotation.x=-Math.PI/2;const tilt=new THREE.Group();tilt.rotation.z=.22;tilt.add(s);m.add(tilt);m.userData.mat=mat;return m;}
/* flat ribbon along a polyline (lightning, ambient trails); side = cross(direction, up) */
function stripGeo(pts,w,up,taper){const n=pts.length,pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[],d=new THREE.Vector3(),sd=new THREE.Vector3();
  for(let i=0;i<n;i++){d.subVectors(pts[Math.min(n-1,i+1)],pts[Math.max(0,i-1)]).normalize();sd.crossVectors(d,up).normalize().multiplyScalar(w/2*(taper?Math.sin(Math.PI*Math.min(1,.08+i/(n-1)*.92)):1));
    const p=pts[i];pos.set([p.x+sd.x,p.y+sd.y,p.z+sd.z,p.x-sd.x,p.y-sd.y,p.z-sd.z],i*6);uv.set([i/(n-1),0,i/(n-1),1],i*4);if(i<n-1)idx.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);return g;}
const UPY=new THREE.Vector3(0,1,0);
function bolt(a,b,segs,jag){const pts=[];for(let i=0;i<=segs;i++){const u=i/segs,p=new THREE.Vector3().lerpVectors(a,b,u);if(i&&i<segs){p.x+=(Math.random()-.5)*jag;p.z+=(Math.random()-.5)*jag;p.y+=a.y==b.y?0:(Math.random()-.5)*jag*.4;}pts.push(p);}return pts;}
/* lightning crawling over a zone (grab / death hits), plus strikes from above on the deadly ones */
function lightning(it,col,pts){const big=it.c=='death',grp=new THREE.Group(),mat=addMat(hdr(col,3),{opacity:1}),core=addMat(hdr(0xffffff,2.5),{opacity:1});
  const nb=Math.min(9,3+Math.round(pts.length/14));for(let i=0;i<nb;i++){const [x,z]=pts[(i*13)%pts.length],a=Math.random()*Math.PI*2,L=1.4+Math.random()*2.6;
    const p=bolt(new THREE.Vector3(x,.12,z),new THREE.Vector3(x+Math.cos(a)*L,.12,z+Math.sin(a)*L),9,.7);grp.add(new THREE.Mesh(stripGeo(p,.12,UPY,1),mat));grp.add(new THREE.Mesh(stripGeo(p,.04,UPY,1),core));}
  if(big)for(let i=0;i<2;i++){const [x,z]=pts[(i*29+3)%pts.length],p=bolt(new THREE.Vector3(x+(Math.random()-.5)*2,10,z+(Math.random()-.5)*2),new THREE.Vector3(x,.1,z),12,1.1);
    [new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1)].forEach(u=>{grp.add(new THREE.Mesh(stripGeo(p,.22,u,1),mat));grp.add(new THREE.Mesh(stripGeo(p,.07,u,1),core));});}
  scene.add(grp);vfx.push({m:grp,life:1,rate:2.2,upd:(m,l)=>{const f=l*(Math.random()<.35?.25:1);mat.opacity=f;core.opacity=f;}});}
/* ambient trails circling the arena (violet streaks over the cemetery, crimson ones in Kragma's void) */
const RIB_F='uniform vec3 uC;uniform float uT,uO;varying vec2 vUv;'+NOISE+'void main(){float u=fract(vUv.x-uT*uO);float head=pow(u,3.)*smoothstep(1.,.96,u);float edge=1.-abs(vUv.y-.5)*2.;float n=fbm(vec2(vUv.x*14.-uT*1.3,vUv.y*3.));gl_FragColor=vec4(uC*(1.+head*2.),head*edge*(.45+.55*n));}';
function makeRibbons(col,n,seed){const g=new THREE.Group(),r=rnd(seed);g.userData.mats=[];
  for(let i=0;i<n;i++){const R=11.5+r()*8,y=2.5+r()*6,a0=r()*Math.PI*2,len=1.6+r()*2.2,amp=.4+r()*1.2,f=1+r()*2,pts=[];
    for(let k=0;k<=60;k++){const u=k/60,a=a0+u*len,rr=R+Math.sin(u*Math.PI*f)*amp;pts.push(new THREE.Vector3(Math.sin(a)*rr,y+Math.sin(u*Math.PI*2*f+i)*amp*.6,-Math.cos(a)*rr));}
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,vertexShader:FXV,fragmentShader:RIB_F,uniforms:{uC:{value:hdr(col,.6+r()*.6)},uT:{value:r()*10},uO:{value:.12+r()*.18}}});
    const m=new THREE.Mesh(stripGeo(pts,.18+r()*.35,new THREE.Vector3(r()-.5,1,r()-.5).normalize(),1),mat);m.userData.sp=(r()<.5?-1:1)*(.03+r()*.06);g.add(m);g.userData.mats.push(mat);}
  return g;}
/* wisps rising around the boss */
function makeAura(col){const N=90,pos=new Float32Array(N*3),seed=new Float32Array(N*3);for(let i=0;i<N;i++){seed[i*3]=Math.random()*Math.PI*2;seed[i*3+1]=Math.random();seed[i*3+2]=.6+Math.random()*1.6;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({map:DOT,color:hdr(col,1.6),size:.22,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false}));p.userData.seed=seed;p.frustumCulled=false;return p;}
function auraTick(p,now){const s=p.userData.seed,a=p.geometry.attributes.position;for(let i=0;i<a.count;i++){const u=(s[i*3+1]+now*.18)%1,ang=s[i*3]+now*.5+u*2.5,r=s[i*3+2]*(1-u*.35);a.setXYZ(i,Math.cos(ang)*r,u*5.2,Math.sin(ang)*r);}a.needsUpdate=true;}
/* acts → boss VFX objects (circle while casting, blade arcs on swings, cracked floor on slams) */
function actFx(s){const o=[];s.act.forEach(([t0,a,d])=>{
  if(['raise','cast','guard','coffin','flap'].includes(a))o.push({k:'mcircle',t0,t2:t0+d+.35,nocue:1});
  else if(a=='swing'||a=='sweep')o.push({k:'slash',t0,t2:t0+d,nocue:1});
  else if(a=='spin')o.push({k:'slash',t0,t2:t0+d*.55,big:1,nocue:1},{k:'slash',t0:t0+d*.45,t2:t0+d,big:1,flip:1,nocue:1});
  else if(a=='slam')o.push({k:'slamfx',t0,t1:t0+d*.55,t2:t0+d*.55+1.4,nocue:1});});return o;}

/* ================= Just Guard: crossed arms (X) for whoever stands in a JG zone, G badge with a hold timer ================= */
function inZone(it,x,z){
  if(it.k=='disc'){const r=it.rk?lerpKeys(it.rk,T)[0]:it.r;return Math.hypot(x-it.x,z-it.z)<=r+.3;}
  if(it.k=='band'){const ux=Math.sin(it.h*deg),uz=-Math.cos(it.h*deg),dx=x-it.cx,dz=z-it.cz;return Math.abs(dx*ux+dz*uz)<=it.len/2+.3&&Math.abs(-dx*uz+dz*ux)<=it.w/2+.3;}
  const dx=x-it.cx,dz=z-it.cz,r=Math.hypot(dx,dz);if(r<it.r0-.3||r>it.r1+.3)return false;if(it.arc>=360)return true;
  const dh=((Math.atan2(dx,-dz)/deg-it.h)%360+540)%360-180;return Math.abs(dh)<=it.arc/2+8;}
/* per party member: {w: pose weight, hold, prog, fx,fz: what to face}; window = the hit moment, or the whole fill for a Holding JG */
function guardState(t,P,B){const st=P.map(()=>null);
  objs.forEach(({it})=>{if(it.c!='jg'||it.t1==null||!['sector','disc','band'].includes(it.k))return;
    const a=it.hold?it.t0+.2:it.t1-.5,b=it.t1+.3;if(t<a-.15||t>b+.15)return;const w=Math.max(0,Math.min(1,(t-a+.15)/.15,(b+.15-t)/.15));
    let ins=P.map((p,i)=>inZone(it,p[0],p[1])?i:-1).filter(i=>i>=0);
    if(!ins.length&&it.k=='disc'){let bi=-1,bd=it.r+2.5;P.forEach((p,i)=>{const dd=Math.hypot(p[0]-it.x,p[1]-it.z);if(dd<bd){bd=dd;bi=i;}});if(bi>=0)ins=[bi];}
    let fx=B.position.x,fz=B.position.z;if(it.k=='sector'&&(it.cx||it.cz)){fx=it.cx;fz=it.cz;}
    const orb=objs.find(o=>(o.it.k=='orb'||o.it.k=='orbStatic')&&o.m.visible);if(orb&&it.k=='disc'){fx=orb.m.position.x;fz=orb.m.position.z;}
    const prog=it.hold?Math.max(0,Math.min(1,(t-a)/Math.max(.01,it.t1-a))):0;
    ins.forEach(i=>{if(!st[i]||w>st[i].w)st[i]={w,hold:!!it.hold,prog,fx,fz};});});
  return st;}
const _v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3(),_f=new THREE.Vector3(),_r=new THREE.Vector3(),_t=new THREE.Vector3(),_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_q3=new THREE.Quaternion();
/* rotate bone b so the direction to its child c points along dir (world space), blended by w */
function aimBone(b,c,dir,w){b.getWorldPosition(_v1);c.getWorldPosition(_v2);_v2.sub(_v1).normalize();
  _q1.setFromUnitVectors(_v2,_v3.copy(dir).normalize());b.getWorldQuaternion(_q2);_q1.multiply(_q2);
  b.parent.getWorldQuaternion(_q3).invert();_q3.multiply(_q1);b.quaternion.slerp(_q3,w);b.updateMatrixWorld(true);}
function guardPose(p,w){const d=p.userData;p.updateMatrixWorld(true);const ry=p.rotation.y;_f.set(Math.sin(ry),0,Math.cos(ry));_r.set(Math.cos(ry),0,-Math.sin(ry));
  d.bones.forEach(([up,lo,hd])=>{up.getWorldPosition(_v1);const s=Math.sign(_v1.sub(p.position).dot(_r))||1;
    // upper arm forward, a little down and inwards; forearm up and across, so both forearms cross in an X in front of the face
    _t.copy(_f).multiplyScalar(.72).addScaledVector(_r,-s*.6);_t.y-=.18;aimBone(up,lo,_t,w);
    _t.set(0,.85,0).addScaledVector(_r,-s*.72).addScaledVector(_f,s>0?.2:.05);aimBone(lo,hd,_t,w);});}
const gCan=document.createElement('canvas');gCan.width=gCan.height=128;let gTexr=null,gLast='';
function drawG(hold,prog){const key=hold+':'+(hold?Math.round(prog*60):0);if(key==gLast)return;gLast=key;const g=gCan.getContext('2d'),c=64;g.clearRect(0,0,128,128);
  const gr=g.createRadialGradient(c,c,8,c,c,64);gr.addColorStop(0,'rgba(255,138,30,.6)');gr.addColorStop(1,'rgba(255,138,30,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
  if(hold){g.lineWidth=9;g.strokeStyle='rgba(16,8,3,.8)';g.beginPath();g.arc(c,c,50,0,7);g.stroke();
    g.lineCap='round';g.strokeStyle=prog>=.999?'#fff3d6':'#ffb44a';g.beginPath();g.arc(c,c,50,-Math.PI/2,-Math.PI/2+Math.max(.02,prog)*Math.PI*2);g.stroke();}
  g.fillStyle='rgba(20,11,5,.92)';g.beginPath();g.arc(c,c,35,0,7);g.fill();g.lineWidth=4;g.strokeStyle='#ff8a1e';g.stroke();
  g.font='900 46px "Golos Text", "Segoe UI", sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffe2b8';g.fillText('G',c,c+3);if(gTexr)gTexr.needsUpdate=true;}

/* fear wave: a dark wall of shadow sweeping outwards; party members jump it (space bar) unless the sim hides them behind coffins */
const waveR=(it,t)=>.5+(t-it.t0)/(it.t2-it.t0)*10;
const FEAR_F='uniform vec3 uC;uniform float uA,uT;varying vec2 vUv;'+NOISE+'void main(){float y=vUv.y;float n=fbm(vec2(vUv.x*60.-uT*2.,y*3.-uT*1.5));float rim=smoothstep(.82,1.,y)*(.55+.45*n);'+
  'float body=(1.-y*.35)*(.85+.15*n);vec3 c=mix(vec3(.012,.004,.022),uC,rim);float a=clamp(body+rim*.6,0.,1.)*smoothstep(1.,.93,y)*uA;gl_FragColor=vec4(c*(1.+rim*1.5),a);}';
function makeFearWave(it,y){const m=new THREE.Group();
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1.5,128,1,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,vertexShader:FXV,fragmentShader:FEAR_F,
    uniforms:{uC:{value:hdr(0x8a4dff,1.6)},uA:{value:0},uT:{value:0}}}));wall.position.y=.75;m.add(wall);
  const floor=new THREE.Mesh(new THREE.RingGeometry(.9,1.02,128),new THREE.MeshBasicMaterial({color:0x08030d,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.position.y=y+.02;m.add(floor);
  m.position.set(it.x,0,it.z);m.userData={wall,floor};return m;}
/* jump height for a party member at (x,z): a hop timed so they are at the top when the wave front passes */
function jumpH(t,x,z){let h=0;objs.forEach(({it})=>{if(it.k!='wave'||it.c!='fear'||it.nojump||t<it.t0||t>it.t2)return;
  const d=Math.hypot(x-it.x,z-it.z)-waveR(it,t),q=d/1.3;if(Math.abs(q)<1)h=Math.max(h,1.75*(1-q*q));});return h;}

/* automatic cues: every JG telegraph gets the gold swirl, every co-op counter ring the blue one */
function autoCues(items){const out=[];items.forEach(it=>{if(it.nocue)return;
    if(it.c=='jg'&&(it.k=='sector'||it.k=='disc')){const x=it.k=='disc'?it.x:it.cx,z=it.k=='disc'?it.z:it.cz,r=it.k=='disc'?Math.min(it.r>5?3.6:it.r*1.15,4.2):3.4;
      out.push({k:'cue',kind:'jg',x:x||0,z:z||0,r,t0:it.t0,t1:it.t1,t2:it.t2});}
    else if(it.c=='cnt'&&it.k=='sector'&&it.arc>=360&&it.r0>=1.6&&it.r1<=2.6)out.push({k:'cue',kind:'coop',x:it.cx||0,z:it.cz||0,r:3,t0:it.t0,t1:it.t1,t2:it.t2});});
  return out;}
/* per-gate lighting: cold moonlit graveyard vs violet void lit by Chaktum's portal */
function setLighting(g2){const U=scene.userData,m=U.moon,h=U.hemi,f=U.fill,rl=U.rim;
  if(g2){h.color.setHex(0x5a4c86);h.groundColor.setHex(0x14070e);h.intensity=.24;m.color.setHex(0xd8ccf0);m.intensity=.8;m.position.set(7,20,-9);f.color.setHex(0x6a7cff);f.intensity=.32;f.position.set(-2,8,-18);rl.color.setHex(0xff3a5a);rl.intensity=.7;rl.position.set(4,4,16);R.toneMappingExposure=.95;}
  else{h.color.setHex(0x7c78a8);h.groundColor.setHex(0x0e0a0c);h.intensity=.17;m.color.setHex(0xbcc6ff);m.intensity=.72;m.position.set(-9,18,-12);f.color.setHex(0x8a7cff);f.intensity=.26;f.position.set(6,9,14);rl.color.setHex(0xa36bff);rl.intensity=.55;rl.position.set(0,6,-16);R.toneMappingExposure=.8;}
}
function buildSim(key){
  if(!scene||!SIMS[key])return;clearSim();sim=SIMS[key];simKey=key;T=0;lastT=0;
  const g2=sim.g==2;bossA.visible=!g2;bossB.visible=g2;envA.visible=!g2;envB.visible=g2;clockA.visible=!g2&&showClock;clockB.visible=g2&&showClock;
  floorMesh.material=g2?floorB:floorA;floorMesh.visible=!(g2?envB:envA).userData.glb;setLighting(g2);glbGate(g2);
  auraA.visible=ribA.visible=!g2;auraB.visible=ribB.visible=g2;scene.userData.bossL.color.setHex(g2?0xff3a4a:0xa36bff);gMark.visible=false;party.forEach(p=>{p.userData.gw=p.userData.gTarget=0;});
  scene.fog.color.setHex(g2?0x12070f:0x0b0a10);scene.fog.density=g2?.018:.024;R.setClearColor(g2?0x120a1a:0x0d0b10,1);
  if(sim.cam&&camMode=='orbit'){if(!camSaved)camSaved=[el,az];el=sim.cam.el;az=sim.cam.az;}else if(camSaved&&!sim.cam){[el,az]=camSaved;camSaved=null;}
  let y=.03;
  sim.items.concat(autoCues(sim.items),actFx(sim)).forEach(it=>{
    let m;y+=.0022;const tele=['sector','band','disc'].includes(it.k)&&!['void','medusa'].includes(it.c);
    if(it.k=='sector'){m=new THREE.Mesh(sectorGeo(it.r0,it.r1,it.h,it.arc),tele?tMat(it.c,{r0:it.r0,r1:it.r1}):new THREE.MeshBasicMaterial({color:COL[it.c],transparent:true,opacity:0,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(it.cx,y,it.cz);}
    else if(it.k=='band'){m=new THREE.Mesh(new THREE.PlaneGeometry(it.w,it.len),tMat(it.c,{mode:1}));m.rotation.order='YXZ';m.rotation.y=-it.h*deg;m.rotation.x=-Math.PI/2;m.position.set(it.cx,y,it.cz);}
    else if(it.k=='disc'){m=new THREE.Mesh(new THREE.CircleGeometry(1,64),tele?tMat(it.c,{r0:0,r1:1}):new THREE.MeshBasicMaterial({color:COL[it.c],transparent:true,opacity:0,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(it.x,y,it.z);m.scale.set(it.r,it.r,1);}
    else if(it.k=='void'){m=new THREE.Mesh(it.ring?new THREE.RingGeometry(it.r0,it.r,64):new THREE.CircleGeometry(it.r,48),new THREE.MeshBasicMaterial({color:COL.void,transparent:true,opacity:0,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(it.x,y+.01,it.z);}
    else if(it.k=='wave'&&it.c=='fear')m=makeFearWave(it,y);
    else if(it.k=='wave'){m=new THREE.Mesh(new THREE.RingGeometry(.85,1,64),new THREE.MeshBasicMaterial({color:COL[it.c],transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));m.rotation.x=-Math.PI/2;m.position.set(it.x,y+.02,it.z);}
    else if(it.k=='coffin'){const c=makeCoffin(it.red);if(it.up){m=new THREE.Group();c.scale.setScalar(it.s||.6);c.rotation.x=-Math.PI/2;c.position.y=1.45*(it.s||.6);m.add(c);}else{m=c;if(it.s)m.scale.setScalar(it.s);}m.rotation.y=-it.h*deg;m.position.set(it.x,0,it.z);}
    else if(it.k=='line'&&!it.laser){m=new THREE.Group();m.add(makeSpine(it.len,it.col));}
    else if(it.k=='line'){m=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(it.laser?.12:.22,it.laser?.12:.12,it.len,10),it.laser?new THREE.MeshBasicMaterial({color:it.col}):std(it.col,{emissive:it.col,emissiveIntensity:.3}));b.rotation.x=Math.PI/2;b.position.set(0,it.laser?.8:.3,-it.len/2);m.add(b);if(it.laser){const gl=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,it.len,10,1,true),new THREE.MeshBasicMaterial({color:it.col,transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false}));gl.rotation.x=Math.PI/2;gl.position.set(0,.8,-it.len/2);m.add(gl);}}
    else if(it.k=='fan'){m=makeCultist(it.small?.6:1);m.position.set(it.x,0,it.z);m.lookAt(0,0,0);}
    else if(it.k=='orbStatic'&&it.cyan){m=new THREE.Group();const R=it.r||1.6;const s1=new THREE.Mesh(new THREE.SphereGeometry(R,28,20),new THREE.MeshStandardMaterial({color:0x1f8f9c,emissive:0x0a3f48,transparent:true,opacity:.5,roughness:.2,depthWrite:false}));m.add(s1);
      const s2=new THREE.Mesh(new THREE.SphereGeometry(R*1.04,24,16),addMat(0x7fe8f0,{map:swirlTex(),opacity:.32}));m.add(s2);m.userData.sw=s2;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:DOT,color:0x157a86,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(R*3,R*3,1);m.add(sp);m.position.set(it.x,R+.2,it.z);}
    else if(it.k=='orb'||it.k=='orbStatic'){m=new THREE.Group();m.add(new THREE.Mesh(new THREE.SphereGeometry(.45,20,16),new THREE.MeshBasicMaterial({color:0x9ec8ff})));const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:DOT,color:0x6ea9ff,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(2.6,2.6,1);m.add(sp);if(it.k=='orbStatic')m.position.set(it.x,1.1,it.z);}
    else if(it.k=='chak'){m=new THREE.Group();const s=new THREE.Mesh(new THREE.IcosahedronGeometry(2.6,1),std(0x2a1d33,{emissive:0x3a1450,flatShading:true}));m.add(s);const tor=new THREE.Mesh(new THREE.TorusGeometry(3.4,.18,8,48),new THREE.MeshBasicMaterial({color:0x5fe0d0}));m.add(tor);const eye=new THREE.Mesh(new THREE.SphereGeometry(.6,16,12),new THREE.MeshBasicMaterial({color:0xff5a3c}));eye.position.z=2.3;m.add(eye);m.position.set(it.x!=null?it.x:0,6,it.z!=null?it.z:-15);m.lookAt(0,0,0);}
    else if(it.k=='bossring'){m=new THREE.Group();const t=new THREE.Mesh(new THREE.TorusGeometry(1,.1,8,48),new THREE.MeshBasicMaterial({color:0xc08cff}));m.add(t);for(let i=0;i<12;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.06,.3,4),t.material);const a=i/12*Math.PI*2;c.position.set(Math.cos(a)*1.1,Math.sin(a)*1.1,0);c.rotation.z=a-Math.PI/2;m.add(c);}}
    else if(it.k=='mirror')m=makePortal(it);
    else if(it.k=='mirrorOld'){m=new THREE.Group();const f=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.6,.15),std(0x2a2630,{metalness:.7,roughness:.3}));f.position.y=1.3;m.add(f);const gl=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.2),new THREE.MeshBasicMaterial({color:it.dark?0x050507:0xa77fe4}));gl.position.set(0,1.3,.09);m.add(gl);m.position.set(it.x,0,it.z);m.lookAt(0,0,0);shadowize(m);}
    else if(it.k=='wallm')m=makeSpears();
    else if(it.k=='clone'){m=ghost();m.position.set(it.x||0,0,it.z||0);}
    else if(it.k=='jgmark'||it.k=='cntmark'){m=new THREE.Mesh(new THREE.TorusGeometry(.7,.08,8,32),new THREE.MeshBasicMaterial({color:it.k=='jgmark'?0xff8a1e:0x3f8cff}));m.position.set(it.x,1.9,it.z);}
    else if(it.k=='flash'){m=new THREE.Sprite(new THREE.SpriteMaterial({map:DOT,color:0xffffff,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));m.position.set(it.x,1.6,it.z);}
    else if(it.k=='vortex'){m=new THREE.Group();const mat=new THREE.MeshBasicMaterial({color:0x9a6a8a,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.CylinderGeometry(it.r+i*.25,it.r+.5+i*.25,2.5+i,48,1,true),mat);c.position.y=1.2+i*.4;m.add(c);}}
    else if(it.k=='stalk'){m=new THREE.Group();const n=10,L=it.r||9.6;for(let i=0;i<n;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.22-i*.012,8,6),std(0x2a3a2a,{emissive:0x0c2a1a}));const p=dir(it.h,1.6+i/(n-1)*(L-1.6));s.position.set(p[0],.15,p[1]);m.add(s);}}
    else if(it.k=='grid'){m=new THREE.Group();const lm=new THREE.LineBasicMaterial({color:0x8a7a9a,transparent:true,opacity:.55});const o=-(it.n)/2*it.s,pts=[];for(let i=0;i<=it.n;i++){const q=o+i*it.s;pts.push(new THREE.Vector3(o,.02,q),new THREE.Vector3(-o,.02,q),new THREE.Vector3(q,.02,o),new THREE.Vector3(q,.02,-o));}m.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),lm));}
    else if(it.k=='tether'){m=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1,6),new THREE.MeshBasicMaterial({color:0xb04050}));const a=new THREE.Vector3(it.x1,1.2,it.z1),b2=new THREE.Vector3(it.x2,1.2,it.z2);m.position.copy(a).add(b2).multiplyScalar(.5);m.scale.y=a.distanceTo(b2);m.lookAt(b2);m.rotateX(Math.PI/2);}
    else if(it.k=='cue')m=makeCue(it);
    else if(it.k=='pillar')m=makePillar(it);
    else if(it.k=='sigil')m=makeSigil(it);
    else if(it.k=='blade')m=makeBlade();
    else if(it.k=='decal')m=makeDecal(it);
    else if(it.k=='mist')m=makeMist(it);
    else if(it.k=='beam')m=makeBeam(it);
    else if(it.k=='flesh'){m=makeFlesh();m.position.set(it.x,0,it.z);m.lookAt(0,0,0);}
    else if(it.k=='twister')m=makeTwister(it);
    else if(it.k=='mcircle')m=makeCircle(g2);
    else if(it.k=='slash')m=makeSlash(g2,it.big);
    else if(it.k=='slamfx'){m=new THREE.Group();const dc=makeDecal({r:3.6,pat:'cracks',seed:9,col:g2?0xff5a4a:0xb98cff});dc.position.set(0,.1,0);m.add(dc);m.userData.dc=dc;}
    else m=new THREE.Group();
    m.visible=false;scene.add(m);objs.push({m,it});
  });
  $('#simName').textContent=sim.n;
  $('#simGate').textContent=sim.g==1?'Врата I · Sanctuary of Holy Rest':"Врата II · Kragma's Field of Annihilation";
  $('#gauge').hidden=!sim.gauge;if(sim.gauge)$('#gaugeLbl').textContent=sim.gLbl;
  $('#steps').innerHTML=sim.steps.map(([t,s])=>`<li data-t="${t}"><span class="num">${t.toFixed(1)} с</span><span>${s}</span></li>`).join('');
  $$('#steps li').forEach(li=>li.onclick=()=>{T=+li.dataset.t;lastT=T;apply();});
  ['#selG1','#selG2'].forEach(s=>{const e=$(s);if(e)e.value=SIMS[key].g==(s=='#selG1'?1:2)?key:'';});
  try{localStorage.setItem('belg_sim',key);}catch(e){}
  try{history.replaceState(null,'','#sim-'+key);}catch(e){}
  if(window.onSimBuilt)window.onSimBuilt(key,sim);
  apply();}

/* ================= animation ================= */
function lerpKeys(keys,t){if(t<=keys[0][0])return keys[0].slice(1);for(let i=1;i<keys.length;i++){if(t<keys[i][0]){const a=keys[i-1],b=keys[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);}}return keys[keys.length-1].slice(1);}
const ease=u=>u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
function partyAt(t){const K=sim.party;let idx=0;for(let i=0;i<K.length;i++)if(t>=K[i][0])idx=i;
  if(idx>0){const u=Math.min(1,(t-K[idx][0])/.55),e=ease(u),from=K[idx-1][1],to=K[idx][1];return to.map((p,i)=>[from[i][0]+(p[0]-from[i][0])*e,from[i][1]+(p[1]-from[i][1])*e]);}
  return K[0][1];}
function poseA(t){const P=bossA.userData.P;let rx=0,rz=0,lx=0,lz=0,re=0,le=0,spin=0,glow=0,cof=false,flap=0;
  sim.act.forEach(([s,a,d])=>{if(t<s||t>s+d)return;const u=(t-s)/d,env=Math.sin(Math.PI*u);
    if(a=='raise'){const k=Math.min(1,u*4)*Math.min(1,(1-u)*4);rx-=2.6*k;lx-=2.6*k;re-=.3*k;le-=.3*k;}
    else if(a=='swing'){rx-=1.5*env;rz=1.3-2.6*ease(u);re-=.4*env;}
    else if(a=='slam'){const v=u<.55?-2.9*ease(u/.55):-2.9+3.6*ease((u-.55)/.45);rx+=v;lx+=v;}
    else if(a=='spin'){spin+=Math.PI*2*ease(u);rz=1.4*env;lz=-1.4*env;}
    else if(a=='guard'){rx-=1.4*Math.min(1,u*5);re-=.9*Math.min(1,u*5);glow=1;}
    else if(a=='coffin'){cof=true;lx-=1.2*Math.min(1,u*5);le-=.5;}
    else if(a=='cast'){lx-=1.6*env;rx-=.6*env;}
    else if(a=='flap'){flap=env;}});
  const id=Math.sin(t*2)*.07;
  P.R.sh.rotation.set(-(rx+id),0,rz-.12);P.L.sh.rotation.set(-(lx-id),0,lz+.12);P.R.el.rotation.x=-re+.15;P.L.el.rotation.x=-le+.15;
  P.cof.visible=cof;P.edge.material.color.setHex(glow?0xff8a1e:0x9fe9d5);P.halo.rotation.z=t;
  P.wings.forEach(w=>{const s=w.userData.s,o=flap?.4+Math.abs(Math.sin(t*14))*.8*flap:0;w.rotation.set(-.15,s*(-.3-o*1.2),s*o*.4);w.scale.setScalar(1+flap*.35);});
  P.core.scale.setScalar(1+.18*Math.sin(t*3));P.coreL.intensity=1+.5*Math.sin(t*3)+glow;
  // cloth sway
  const pa=P.coat.geometry.attributes.position,b=P.coatBase;for(let i=0;i<pa.count;i++){const y=b[i*3+1];const w=(1-y/2.3)*.06;pa.setXYZ(i,b[i*3]+Math.sin(t*2.2+y*3+b[i*3+2]*2)*w,y,b[i*3+2]+Math.cos(t*1.8+y*2+b[i*3])*w);}pa.needsUpdate=true;
  {const cp=P.cape.geometry.attributes.position,cb=P.capeBase;for(let i=0;i<cp.count;i++){const x=cb[i*3],y=cb[i*3+1],k=-y/3.3;cp.setXYZ(i,x*(1+k*.25),y,cb[i*3+2]+k*k*(.55+.18*Math.sin(t*1.7+x*2.2+y*1.3))+Math.sin(t*2.4+x*3)*.05*k+(flap?flap*k*.6:0));}cp.needsUpdate=true;}
  bossA.userData.spin=spin;}
function poseB(t){const P=bossB.userData.P;let ext=0,lift=0,spin=0,back=0,glow=0;
  sim.act.forEach(([s,a,d])=>{if(t<s||t>s+d)return;const u=(t-s)/d,env=Math.sin(Math.PI*u);
    if(a=='grab'){ext=Math.max(ext,env);}else if(a=='slam'){lift=u<.55?ease(u/.55):1-ease((u-.55)/.45)*1.3;}
    else if(a=='raise'){lift=Math.max(lift,env);}else if(a=='spin'){spin+=Math.PI*2*ease(u);ext=Math.max(ext,env*.5);}
    else if(a=='sling'){back=env;}else if(a=='sweep'){spin+=Math.sin(u*Math.PI*2)*.8;ext=Math.max(ext,env*.6);}
    else if(a=='guard'){glow=1;}});
  P.body.position.y=Math.sin(t*1.6)*.08+lift*.4;P.head.position.y=4.1+Math.sin(t*1.6)*.1+lift*.5;P.head.rotation.y=Math.sin(t*.7)*.15;P.shards.rotation.y=t*.6;P.shards.position.y=5.3+lift*.5;
  P.core.material.color.setHex(glow?0xff8a1e:0xff5a3c);P.core.scale.setScalar(1+.12*Math.sin(t*4));P.coreL.color.setHex(glow?0xff8a1e:0xff4a3a);
  const up=new THREE.Vector3(0,1,0);
  P.arms.forEach((A,i)=>{const len=A.L*(1+ext*.7),a0=A.h*deg,n=A.segs.length;
    for(let k=0;k<=n;k++){const f=k/n,r=.9+f*len,sway=Math.sin(t*2+i*1.7+f*3)*.35*(1-ext*.6),ang=a0+sway*f*.6;
      const y=2.6-f*2.2+lift*f*3.2*Math.sin(f*Math.PI*.9)+(1-ext)*Math.sin(f*Math.PI)*1.1;A.pts[k].set(Math.sin(ang)*r*(1-back*.4*f),Math.max(.2,y),-Math.cos(ang)*r*(1-back*.4*f)+back*f*1.5);}
    for(let k=0;k<n;k++){const a=A.pts[k],b=A.pts[k+1],s=A.segs[k];s.position.copy(a).add(b).multiplyScalar(.5);const d=tmpV.copy(b).sub(a),L=d.length();s.scale.set(1,L+.05,1);s.quaternion.setFromUnitVectors(up,d.normalize());}
    A.claw.position.copy(A.pts[n]);A.claw.quaternion.copy(A.segs[n-1].quaternion);
    });
  bossB.userData.spin=spin;}
/* points along a telegraph's shape, so the impact plays out over the whole zone */
function shapePts(it,n){const o=[];for(let i=0;i<n;i++){const u=Math.random(),v=Math.random();
  if(it.k=='band'){const ux=Math.sin(it.h*deg),uz=-Math.cos(it.h*deg),al=(u-.5)*it.len,ac=(v-.5)*it.w;o.push([it.cx+ux*al-uz*ac,it.cz+uz*al+ux*ac]);}
  else if(it.k=='sector'){const a=(it.h+(u-.5)*Math.min(it.arc,360))*deg,r=it.r0+(it.r1-it.r0)*Math.sqrt(v);o.push([it.cx+Math.sin(a)*r,it.cz-Math.cos(a)*r]);}
  else if(it.k=='disc'){const a=u*Math.PI*2,r=it.r*Math.sqrt(v);o.push([it.x+Math.cos(a)*r,it.z+Math.sin(a)*r]);}
  else o.push([it.x||0,it.z||0]);}return o;}
function impact(it){const col=COL[it.c]||0xffffff,big=it.c=='death',[cx,cz]=itemCenter(it),area=it.k=='band'?it.w*it.len:it.k=='disc'?Math.PI*it.r*it.r:Math.PI*(it.r1*it.r1-it.r0*it.r0)*Math.min(it.arc,360)/360;
  const n=Math.round(Math.min(160,Math.max(24,area*1.6))),pts=shapePts(it,n);
  // sparks
  const pos=new Float32Array(n*3),vel=[];pts.forEach(([x,z],i)=>{pos[i*3]=x;pos[i*3+1]=.15;pos[i*3+2]=z;const a=Math.random()*6.283,v=.6+Math.random()*2.6;vel.push([Math.cos(a)*v,3+Math.random()*(big?7:4.5),Math.sin(a)*v]);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const sp=new THREE.Points(g,new THREE.PointsMaterial({map:DOT,color:hdr(col,2.4),size:big?.5:.36,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(sp);fx.push({m:sp,vel,life:1});
  // stone debris
  const dn=Math.round(n*.45),dp=new Float32Array(dn*3),dv=[];for(let i=0;i<dn;i++){const [x,z]=pts[i];dp[i*3]=x;dp[i*3+1]=.1;dp[i*3+2]=z;const a=Math.random()*6.283,v=.5+Math.random()*2;dv.push([Math.cos(a)*v,2+Math.random()*4,Math.sin(a)*v]);}
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
  const db=new THREE.Points(dg,new THREE.PointsMaterial({map:DOT,color:0x1a1620,size:.2,transparent:true,opacity:1,depthWrite:false}));scene.add(db);fx.push({m:db,vel:dv,life:1});
  // flash on the ground: the zone itself lights up and fades
  const flashMat=new THREE.MeshBasicMaterial({color:new THREE.Color(col).lerp(new THREE.Color(0xffffff),.1),transparent:true,opacity:.32,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),fOp=.32*Math.max(.35,Math.min(1,40/area));
  let fl;if(it.k=='band'){fl=new THREE.Mesh(new THREE.PlaneGeometry(it.w,it.len),flashMat);fl.rotation.order='YXZ';fl.rotation.y=-it.h*deg;fl.rotation.x=-Math.PI/2;fl.position.set(it.cx,.06,it.cz);}
  else if(it.k=='disc'){fl=new THREE.Mesh(new THREE.CircleGeometry(it.r,48),flashMat);fl.rotation.x=-Math.PI/2;fl.position.set(it.x,.06,it.z);}
  else{fl=new THREE.Mesh(sectorGeo(it.r0,it.r1,it.h,Math.min(it.arc,360)),flashMat);fl.rotation.x=-Math.PI/2;fl.position.set(it.cx,.06,it.cz);}
  scene.add(fl);vfx.push({m:fl,life:1,rate:3.2,upd:(m,l)=>{m.material.opacity=fOp*l*l;}});
  // scorch left behind
  if(it.c=='death'||it.c=='kd'){const sc=fl.clone();sc.material=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});sc.position.y=.05;scene.add(sc);vfx.push({m:sc,life:1,rate:.45,upd:(m,l)=>{m.material.opacity=.42*Math.min(1,l*1.6);}});}
  // rising glow sprites + shockwave
  const fs=Math.min(6,1+Math.round(area/18));for(let i=0;i<fs;i++){const [x,z]=fs==1?[cx,cz]:pts[i*7%n];const s=new THREE.Sprite(new THREE.SpriteMaterial({map:DOT,color:col,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.position.set(x,.8,z);scene.add(s);
    vfx.push({m:s,life:1,rate:2.6,upd:(m,l)=>{const k=1-l;m.scale.setScalar((big?4:2.8)*(.4+k*1.6));m.position.y=.8+k*1.4;m.material.opacity=l*l;}});}
  const sw=new THREE.Mesh(new THREE.RingGeometry(.86,1,64),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));sw.rotation.x=-Math.PI/2;sw.position.set(cx,.09,cz);scene.add(sw);
  const R0=it.k=='band'?Math.max(it.w,it.len)/2:it.k=='disc'?it.r:it.r1;vfx.push({m:sw,life:1,rate:2.2,upd:(m,l)=>{const r=.4+(1-l)*(R0*.9+1.5);m.scale.set(r,r,1);m.material.opacity=.8*l;}});
  // lightning over grabs and deadly hits, dark smoke rolling up, a light column on deadly ones
  if(it.c=='grab'||it.c=='death')lightning(it,col,pts);
  for(let i=0,ns=Math.min(8,2+Math.round(area/12));i<ns;i++){const [x,z]=pts[(i*11)%n],k0=.8+Math.random();const s=new THREE.Sprite(new THREE.SpriteMaterial({map:DOT,color:0x0a070c,transparent:true,depthWrite:false,opacity:0}));s.position.set(x,.5,z);scene.add(s);
    vfx.push({m:s,life:1,rate:.85,upd:(m,l)=>{const k=1-l;m.scale.setScalar(k0*(1+k*2.6));m.position.y=.5+k*1.7;m.material.opacity=.6*Math.sin(Math.PI*Math.min(1,k*1.15));}});}
  if(big){const pl=makePillar({x:cx,z:cz,r:Math.min(2.2,R0*.3+.6),h:12,col:hdr(col,1.5)});scene.add(pl);vfx.push({m:pl,life:1,rate:2,upd:(m,l)=>{const k=1-l;m.scale.set(1+k*.6,Math.min(1,k*8),1+k*.6);m.children.forEach(c=>c.material.opacity=l*l);}});}
  // light flash
  const L=FLASH[flashI++%FLASH.length];if(L){L.color.setHex(col);L.position.set(cx,1.4,cz);L.userData.v=big?7:4;L.distance=Math.max(10,R0*2.4);}
}
function burstAt(x,z,col,n){const N=n||36,pos=new Float32Array(N*3),vel=[];for(let i=0;i<N;i++){pos[i*3]=x;pos[i*3+1]=.3;pos[i*3+2]=z;const a=Math.random()*Math.PI*2,v=2+Math.random()*5;vel.push([Math.cos(a)*v,2+Math.random()*5,Math.sin(a)*v]);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({map:DOT,color:col,size:.42,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(m);fx.push({m,vel,life:1});
  const sh=new THREE.Mesh(new THREE.RingGeometry(.8,1,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));sh.rotation.x=-Math.PI/2;sh.position.set(x,.08,z);sh.userData.life=1;scene.add(sh);shocks.push(sh);}
function apply(){
  if(!sim||!scene)return;const t=T,g2=sim.g==2,B=g2?bossB:bossA;
  const bs=lerpKeys(sim.boss.map(k=>[k[0],k[1],k[2],k[3]]),t);let hid=0;for(const k of sim.boss)if(t>=k[0])hid=k[4]||0;
  if(B.userData.glb){glbPose(B,t);B.userData.spin=0;}else g2?poseB(t):poseA(t);
  glbCollapse(g2?envB:envA,t);
  B.position.set(bs[0],0,bs[1]);B.rotation.y=-bs[2]*deg+(B.userData.spin||0);B.visible=!hid;B.userData.head=bs[2];
  {const BL=scene.userData.bossL,au=g2?auraB:auraA;BL.position.set(bs[0],3.4,bs[1]);BL.intensity=hid?0:1.6;au.position.set(bs[0],0,bs[1]);au.visible=!hid;}
  const hp=dir(bs[2],2.6);arrow.position.set(bs[0]+hp[0],.07,bs[1]+hp[1]);arrow.rotation.y=-bs[2]*deg;arrow.visible=!hid;
  const fly=objs.find(o=>o.it.k=='flyparty'&&t>=o.it.t0&&t<=o.it.t2);
  if(partyReady){const P=partyAt(t),GS=guardState(t,P,B);party.forEach((p,i)=>{const [x,z]=P[i];p.position.set(x,fly?1.6+Math.sin(t*3+i)*.2:jumpH(t,x,z),z);
      const d=p.userData,dx=x-d.prev.x,dz=z-d.prev.z,mv=Math.hypot(dx,dz);d.speed=mv;
      const gs=GS[i];d.gTarget=gs?gs.w:0;
      const target=gs?Math.atan2(gs.fx-x,gs.fz-z):mv>.01?Math.atan2(dx,dz):Math.atan2(bs[0]-x,bs[1]-z);p.rotation.y=target;d.prev.set(x,0,z);
      d.ring.position.y=fly?.03:.03-p.position.y;d.ring.material.color.setHex(i==me?0xffffff:d.col);d.ring.scale.setScalar(i==me?1.35:1);d.lab.visible=showLabels||i==me;});
    // one G badge: over the chosen player if they guard, else over the first guarding one
    let gi=-1;GS.forEach((g,i)=>{if(g&&g.w>.05&&(gi<0||i==me&&gi!=me||gi!=me&&g.w>GS[gi].w+.01))gi=i;});
    if(gi>=0){const g=GS[gi],p=party[gi];drawG(g.hold,g.prog);gMark.visible=true;gMark.position.set(p.position.x,p.position.y+2.95,p.position.z);gMark.material.opacity=Math.min(1,g.w*1.6);gMark.scale.setScalar(.95+(g.hold?0:.06*Math.sin(t*14)));}else gMark.visible=false;}
  let glitch=false;
  objs.forEach(o=>{const {m,it}=o;const on=t>=it.t0&&t<=it.t2;m.visible=on;
    if(it.k=='glitch'){if(on)glitch=true;return;}
    if(!on)return;
    if(m.material&&m.material.uniforms&&m.material.uniforms.uProg){const U=m.material.uniforms;U.uT.value=t;
      if(it.c=='safe'){U.uA.value=1;U.uProg.value=1;U.uFl.value=0;}
      else if(t<it.t1){const u=(t-it.t0)/Math.max(.01,it.t1-it.t0);U.uProg.value=u;U.uA.value=Math.min(1,u*6);U.uFl.value=0;}
      else{const u=(t-it.t1)/Math.max(.01,it.t2-it.t1);U.uProg.value=1;U.uA.value=1-u;U.uFl.value=Math.max(0,1-u*3.5);}
      if(it.rk){const r=lerpKeys(it.rk,t)[0];m.scale.set(r,r,1);}}
    else if(['sector','disc','void'].includes(it.k)){let op;if(it.c=='medusa'){op=t<it.t1?.25+.5*(t-it.t0)/(it.t1-it.t0):.8*(1-(t-it.t1)/(it.t2-it.t1));}
      else if(it.c=='void'){op=it.stay?(t<it.t1?.3+.2*Math.sin(t*12):.95):Math.min(.95,(t-it.t0)*2);m.material.color.setHex(t<it.t1&&it.stay?0x2fb8c8:COL.void);}else op=.5;m.material.opacity=op;}
    else if(it.k=='wave'&&it.c=='fear'){const u=(t-it.t0)/(it.t2-it.t0),r=waveR(it,t),a=Math.min(1,u*8)*(1-Math.max(0,u-.8)/.2);m.scale.set(r,1,r);m.userData.wall.material.uniforms.uA.value=a;m.userData.wall.material.uniforms.uT.value=t;m.userData.floor.material.opacity=.95*a;}
    else if(it.k=='wave'){const u=(t-it.t0)/(it.t2-it.t0);const r=.5+u*10;m.scale.set(r,r,1);m.material.opacity=.9*(1-u);}
    else if(it.k=='coffin'){const u=Math.min(1,(t-it.t0)/.35);m.position.y=(1-ease(u))*7;}
    else if(it.k=='line'){const h=lerpKeys(it.rot.map(r=>[r[0],r[1]]),t)[0];m.position.set(B.position.x,0,B.position.z);m.rotation.y=-h*deg;}
    else if(it.k=='orb'){const p=lerpKeys(it.path,t);m.position.set(p[0],1.1,p[1]);if(it.shrink)m.scale.setScalar(t>it.shrink?.6:1);}
    else if(it.k=='wallm'){const p=lerpKeys(it.path,t);m.position.set(p[0],0,p[1]);}
    else if(it.k=='cue'){const U=m.userData,fin=Math.min(1,(t-it.t0)/.25),fout=t>it.t1?1-(t-it.t1)/Math.max(.01,it.t2-it.t1):1,a=fin*fout;
      if(it.follow){m.position.set(B.position.x,0,B.position.z);}
      U.sw.scale.setScalar(it.r*(1+.04*Math.sin(t*9)));U.sw.rotation.z=t*2.2;U.sw.material.opacity=a;U.sw2.scale.setScalar(it.r*.82);U.sw2.rotation.z=-t*3;U.sw2.material.opacity=a*.6;
      const k=t<it.t1?1+1.4*(1-(t-it.t0)/Math.max(.01,it.t1-it.t0)):1+(t-it.t1)*.8;U.tr.scale.setScalar(it.r*k);U.tr.material.opacity=t<it.t1?.9*fin:fout;}
    else if(it.k=='pillar'){const u=(t-it.t0)/Math.max(.01,it.t2-it.t0);m.scale.set(1+u*.3,Math.min(1,u*7),1+u*.3);m.children.forEach(c=>c.material.opacity=(c===m.children[0]?.85:1)*(1-u)*(u<.1?u*10:1));}
    else if(it.k=='sigil'){m.position.set(B.position.x,0,B.position.z);m.rotation.y=-(B.userData.head+(it.h||0))*deg;const a=Math.min(1,(t-it.t0)*3)*Math.min(1,(it.t2-t)*3);m.children.forEach((c,i)=>{(c.material||c.children[0].material).opacity=a*(.75+.25*Math.sin(t*6+i));});}
    else if(it.k=='blade'){const p=lerpKeys(it.path,t);m.position.set(p[0],.9,p[1]);m.rotation.y=t*14;}
    else if(it.k=='decal'){const U=m.material.uniforms;U.uP.value=t<it.t1?Math.min(1,(t-it.t0)/Math.max(.01,it.t1-it.t0)):1;U.uA.value=t<it.t1?1:Math.max(0,1-(t-it.t1)/Math.max(.01,it.t2-it.t1));}
    else if(it.k=='mist'){const U=m.material.uniforms;U.uT.value=t;U.uA.value=Math.min(1,(t-it.t0)*2.2)*Math.min(1,(it.t2-t)*2)*(it.a||.85);}
    else if(it.k=='beam'){const U=m.userData;if(t<it.t1){U.glow.visible=U.core.visible=false;U.aim.visible=true;U.aim.material.opacity=.4+.4*Math.sin(t*30);}
      else{const u=(t-it.t1)/Math.max(.01,it.t2-it.t1);U.aim.visible=false;U.glow.visible=U.core.visible=true;const w=U.w*(u<.12?u/.12:1)*(1-u*.4);U.glow.scale.set(w,1,Math.min(w,1));U.core.scale.set(Math.min(w*.6,.9),1,Math.min(w*.6,.6));U.glow.material.opacity=.45*(1-u);U.core.material.opacity=.95*(1-u);}}
    else if(it.k=='mcircle'){const U=m.userData,a=Math.min(1,(t-it.t0)/.3,(it.t2-t)/.35),Rr=(g2?3.8:3.3)*(.7+.3*ease(Math.min(1,(t-it.t0)/.4)));m.position.set(B.position.x,.1,B.position.z);m.scale.setScalar(Rr);U.a.rotation.z=t*.45;U.b.rotation.z=-t*1.1;U.b.scale.setScalar(.75);U.a.material.opacity=a*.95;U.b.material.opacity=a*.5;U.gl.material.opacity=a*.6;}
    else if(it.k=='slash'){const u=(t-it.t0)/Math.max(.01,it.t2-it.t0),U=m.userData.mat.uniforms;m.position.set(B.position.x,1.3,B.position.z);m.rotation.y=-(B.userData.head||0)*deg+(it.flip?Math.PI:0);U.uP.value=-.05+u*1.75;U.uA.value=Math.min(1,u*5)*(1-Math.max(0,u-.6)/.4);}
    else if(it.k=='slamfx'){const p=dir(B.userData.head||0,2.2),U=m.userData.dc.material.uniforms;m.position.set(B.position.x+p[0],0,B.position.z+p[1]);if(t<it.t1)U.uA.value=0;else{U.uP.value=Math.min(1,(t-it.t1)/.25);U.uA.value=1-Math.max(0,(t-it.t1-.4)/1);}}
    else if(it.k=='twister'){const p=lerpKeys(it.path,t);m.position.set(p[0],0,p[1]);m.rotation.y=t*6;m.children.forEach((c,i)=>c.rotation.y=t*(i%2?-4:3));}
    else if(it.k=='mirror'&&m.userData.inner){m.userData.inner.rotation.z=t*1.5;}
    else if(it.k=='orbStatic'&&m.userData.sw){m.userData.sw.rotation.y=t*1.2;m.userData.sw.rotation.x=t*.7;}
    else if(it.k=='chak'){m.rotation.z=Math.sin(t)*.1;m.position.y=6+Math.sin(t*1.3)*.4;}
    else if(it.k=='bossring'){const r=lerpKeys(it.rk,t)[0];const bk=dir(bs[2],-.9);m.position.set(bs[0]+bk[0],3.4,bs[1]+bk[1]);m.rotation.y=-bs[2]*deg;m.scale.setScalar(r);m.children[0].rotation.z=t*3;}
    else if(it.k=='jgmark'||it.k=='cntmark'){m.rotation.y=t*2;m.scale.setScalar(1+.15*Math.sin(t*6));}
    else if(it.k=='flash'){const u=(t-it.t0)/(it.t2-it.t0);m.scale.setScalar(2+u*8);m.material.opacity=1-u;}
    else if(it.k=='clone'){m.rotation.y=t;}
    else if(it.k=='vortex'){m.rotation.y=t*.9;m.children.forEach((c,i)=>c.rotation.y=t*(i%2?-1.3:1.1));}
    else if(it.k=='stalk'){m.children.forEach((s,i)=>{s.position.y=.15+Math.max(0,Math.sin(t*6-i*.6))*.35;});}
  });
  if(t>lastT&&t-lastT<.2){objs.forEach(o=>{const it=o.it;if(it.t1==null||['safe','medusa','void','light','cnt'].includes(it.c)||!['sector','band','disc'].includes(it.k))return;
    if(lastT<it.t1&&t>=it.t1){impact(it);if(it.c=='death'||it.c=='kd')shake=Math.max(shake,it.c=='death'?.35:.15);}});
    objs.forEach(({it,m})=>{if(it.k=='slamfx'&&lastT<it.t1&&t>=it.t1){burstAt(m.position.x,m.position.z,g2?0xff7a5a:0xc9a8ff,50);shake=Math.max(shake,.22);const L=FLASH[flashI++%FLASH.length];L.color.setHex(g2?0xff5a3a:0xb98cff);L.position.set(m.position.x,1.2,m.position.z);L.userData.v=5;L.distance=12;}});}
  lastT=t;
  $('#stage').classList.toggle('glitchy',glitch);
  if(sim.gauge)$('#gaugeFill').style.width=lerpKeys(sim.gauge,t)[0]+'%';
  let cur=0;sim.steps.forEach((s,i)=>{if(t>=s[0])cur=i;});
  $('#simCap').textContent=sim.steps[cur]?sim.steps[cur][1]:'';
  $$('#steps li').forEach((li,i)=>li.classList.toggle('cur',i==cur));
  $('#scrub').value=Math.round(t/sim.dur*1000);$('#tLbl').textContent=t.toFixed(1)+' / '+sim.dur.toFixed(1)+' с';}

/* ================= camera ================= */
function camTarget(dt){
  const B=sim&&sim.g==2?bossB:bossA,ov=sim&&sim.cam;
  let D=ov&&camMode=='orbit'?ov.dist:dist,e=el,a=az;
  if(camMode=='top'){e=89;}
  else if(camMode=='iso'){e=34;a=45;}
  else if(camMode=='cine'){az+=dt*9;a=az;e=26+Math.sin(performance.now()/4000)*8;D=21;}
  if(camMode=='boss'&&B){const h=(B.userData.head||0)*deg;tmpV.set(B.position.x-Math.sin(h)*5.5,6.2,B.position.z+Math.cos(h)*5.5);tmpV2.set(B.position.x+Math.sin(h)*6,0,B.position.z-Math.cos(h)*6);return;}
  if(camMode=='player'&&partyReady){const p=party[me<0?0:me];const bx=B.position.x,bz=B.position.z;const dx=bx-p.position.x,dz=bz-p.position.z,l=Math.hypot(dx,dz)||1;tmpV.set(p.position.x-dx/l*5,3.6,p.position.z-dz/l*5);tmpV2.set((p.position.x+bx)/2,1.2,(p.position.z+bz)/2);return;}
  const E=e*deg,A=a*deg;tmpV.set(Math.sin(A)*Math.cos(E)*D,Math.sin(E)*D,Math.cos(A)*Math.cos(E)*D);tmpV2.set(0,e>85?0:1,0);}
function bindInput(){
  let drag=null,pinch=null;const pts=new Map();
  canvas.addEventListener('pointerdown',e=>{pts.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY,e.clientX,e.clientY];if(pts.size==2){const v=[...pts.values()];pinch=Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1]);}});
  canvas.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size==2&&pinch){const v=[...pts.values()];const d=Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1]);dist=Math.min(48,Math.max(9,dist*pinch/d));pinch=d;return;}
    if(!drag)return;const dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag[0]=e.clientX;drag[1]=e.clientY;if(camMode!='orbit'&&Math.hypot(e.clientX-drag[2],e.clientY-drag[3])>6)setCam('orbit');az-=dx*.4;el=Math.min(88,Math.max(6,el+dy*.3));});
  const up=e=>{if(drag&&Math.hypot(e.clientX-drag[2],e.clientY-drag[3])<5)pick(e);pts.delete(e.pointerId);if(pts.size<2)pinch=null;if(!pts.size)drag=null;};
  canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.min(48,Math.max(9,dist*(1+e.deltaY*.001)));},{passive:false});}
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
function pick(e){if(!partyReady)return;const r=canvas.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,cam);
  const hits=ray.intersectObjects(party,true);if(hits.length){let o=hits[0].object;while(o&&!party.includes(o))o=o.parent;if(o){setMe(o.userData.i);}}}
function setMe(i){me=i;const s=$('#meSel');if(s)s.value=String(i);if(sim)apply();}
function setCam(m){camMode=m;$$('[data-cam]').forEach(b=>b.classList.toggle('on',b.dataset.cam==m));if(m=='orbit'&&!(sim&&sim.cam)){el=48;}}

/* ================= loop ================= */
let last=0;
function loop(ts){
  requestAnimationFrame(loop);
  if(!R||!visible||document.hidden){last=ts;return;}
  const dt=Math.min(.05,(ts-last)/1000||0);last=ts;const now=ts/1000;
  if(playing&&sim){T+=dt*spd;if(T>sim.dur){T=0;lastT=0;}apply();}
  // party animation blend
  if(partyReady)party.forEach(p=>{const d=p.userData;if(!d.mixer)return;const sp=playing?d.speed/Math.max(dt,1e-3)/Math.max(spd,.01):0;const tgt=sp>3.2?'Run':sp>.25?'Walk':'Idle';
    ['Idle','Walk','Run'].forEach(n=>{if(!d.acts[n])return;d.w[n]+=((n==tgt?1:0)-d.w[n])*Math.min(1,dt*8);d.acts[n].setEffectiveWeight(d.w[n]);});d.mixer.update(dt*(playing?Math.max(.4,spd):.25));});
  if(partyReady)party.forEach(p=>{const d=p.userData;d.gw+=(d.gTarget-d.gw)*Math.min(1,dt*16);if(d.bones&&d.gw>.01)guardPose(p,d.gw);});
  vfx=vfx.filter(v=>{v.life-=dt*v.rate;if(v.life<=0){scene.remove(v.m);v.m.traverse(x=>{x.geometry&&x.geometry.dispose();x.material&&x.material.dispose();});return false;}v.upd(v.m,v.life);return true;});
  FLASH.forEach(l=>{l.userData.v=Math.max(0,l.userData.v-dt*16);l.intensity=l.userData.v;});
  [envA,envB].forEach(e=>{if(e&&e.visible&&e.userData.shafts)e.userData.shafts.forEach(m=>m.material.uniforms.uT.value=now);});
  fx=fx.filter(f=>{f.life-=dt*1.1;const p=f.m.geometry.attributes.position;for(let i=0;i<p.count;i++){f.vel[i][1]-=dt*9;p.setXYZ(i,p.getX(i)+f.vel[i][0]*dt,Math.max(.05,p.getY(i)+f.vel[i][1]*dt),p.getZ(i)+f.vel[i][2]*dt);}p.needsUpdate=true;f.m.material.opacity=Math.max(0,f.life);if(f.life<=0){scene.remove(f.m);f.m.geometry.dispose();return false;}return true;});
  shocks=shocks.filter(s=>{s.userData.life-=dt*1.8;const r=1+(1-s.userData.life)*6;s.scale.set(r,r,1);s.material.opacity=Math.max(0,s.userData.life)*.9;if(s.userData.life<=0){scene.remove(s);return false;}return true;});
  const ap=ash.geometry.attributes.position;for(let i=0;i<ap.count;i++){let y=ap.getY(i)-dt*.35;if(y<0)y=14;ap.setY(i,y);ap.setX(i,ap.getX(i)+Math.sin(now+i)*dt*.12);}ap.needsUpdate=true;
  const bq=blobs.geometry.attributes.position;for(let i=0;i<bq.count;i++){let y=bq.getY(i)-dt*.18,x=bq.getX(i)+dt*(.35+Math.sin(now*.3+i)*.2);if(y<.5)y=13;if(x>20)x=-20;bq.setXYZ(i,x,y,bq.getZ(i));}bq.needsUpdate=true;
  [ribA,ribB].forEach(rb=>{if(!rb.visible)return;rb.userData.mats.forEach(m=>m.uniforms.uT.value+=dt);rb.children.forEach(c=>c.rotation.y+=dt*c.userData.sp);});
  if(auraA.visible)auraTick(auraA,now);if(auraB.visible)auraTick(auraB,now);
  const sp=souls.geometry.attributes.position;for(let i=0;i<sp.count;i++){let y=sp.getY(i)+dt*.5;if(y>9)y=0;sp.setY(i,y);}sp.needsUpdate=true;
  if(envA.visible){skyA.material.uniforms.uT.value=now;fogLayers.forEach(f=>f.material.uniforms.uT.value=now);envA.userData.lights.forEach((l,i)=>l.intensity=.75+.25*Math.sin(now*9+i*3)+.12*Math.sin(now*23+i));}
  if(envB.visible){skyB.material.uniforms.uT.value=now;envB.userData.voidMat.uniforms.uT.value=now;envB.userData.swirl.uniforms.uT.value=now;envB.userData.fog.forEach(f=>f.material.uniforms.uT.value=now);envB.userData.portal.rotation.z=now*.05;envB.userData.rocks.forEach(c=>{c.position.y+=Math.sin(now*.6+c.userData.f)*.004;c.rotation.y+=dt*.1;});}
  objs.forEach(o=>{if(o.m.material&&o.m.material.uniforms&&o.m.material.uniforms.uT&&o.m.visible)o.m.material.uniforms.uT.value=T;});
  camTarget(dt);const k=Math.min(1,dt*(camMode=='orbit'?14:4));camPos.lerp(tmpV,k);camLook.lerp(tmpV2,k);
  cam.position.copy(camPos);if(shake>0){cam.position.x+=(Math.random()-.5)*shake;cam.position.y+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt*1.2);}
  cam.up.set(0,1,0);if(camMode=='top'||(camMode=='orbit'&&el>85))cam.up.set(-Math.sin(az*deg),0,-Math.cos(az*deg));
  cam.lookAt(camLook);
  draw();}

/* ================= UI ================= */
function syncPlay(){$('#play').innerHTML=playing?'❚❚ Пауза':'▶ Играть';}
function buildChips(){
  const mk=(g,id)=>`<div class="simsel"><select id="${id}" aria-label="Механика врат ${g}"><option value="">— врата ${g==1?'I':'II'}: выбрать (${Object.values(SIMS).filter(s=>s.g==g).length}) —</option>${Object.entries(SIMS).filter(([k,s])=>s.g==g).map(([k,s])=>`<option value="${k}">${s.n}</option>`).join('')}</select><button class="btn sm" type="button" data-step="-1" data-g="${g}" aria-label="Предыдущая">◀</button><button class="btn sm" type="button" data-step="1" data-g="${g}" aria-label="Следующая">▶</button></div>`;
  $('#chipsG1').innerHTML=mk(1,'selG1');$('#chipsG2').innerHTML=mk(2,'selG2');
  ['#selG1','#selG2'].forEach(s=>$(s).onchange=e=>{if(e.target.value){buildSim(e.target.value);playing=true;syncPlay();}});
  $$('[data-step]').forEach(b=>b.onclick=()=>step(+b.dataset.g,+b.dataset.step));}
function step(g,d){const keys=Object.keys(SIMS).filter(k=>SIMS[k].g==(g||(sim?sim.g:1)));let i=keys.indexOf(simKey);i=i<0?0:(i+d+keys.length)%keys.length;buildSim(keys[i]);playing=true;syncPlay();}
function bindUI(){
  $('#play').onclick=()=>{playing=!playing;syncPlay();};
  $('#restart').onclick=()=>{T=0;lastT=0;playing=true;syncPlay();apply();};
  $('#scrub').oninput=e=>{if(!sim)return;T=e.target.value/1000*sim.dur;lastT=T;playing=false;syncPlay();apply();};
  $('#speed').onchange=e=>spd=+e.target.value;
  $$('[data-cam]').forEach(b=>b.onclick=()=>setCam(b.dataset.cam));
  const lb=$('#tglLabels');if(lb)lb.onchange=e=>{showLabels=e.target.checked;apply();};
  const ck=$('#tglClock');if(ck)ck.onchange=e=>{showClock=e.target.checked;if(sim){clockA.visible=sim.g==1&&showClock;clockB.visible=sim.g==2&&showClock;}};
  const ms=$('#meSel');if(ms)ms.onchange=e=>{setMe(+e.target.value);if(me>=0&&camMode=='orbit')setCam('player');};
  const fs=$('#btnFull');if(fs)fs.onclick=()=>{const st=$('#stage');if(document.fullscreenElement)document.exitFullscreen();else if(st.requestFullscreen)st.requestFullscreen();};
  const sh=$('#btnShot');if(sh&&window.self!==window.top)sh.hidden=true;if(sh)sh.onclick=()=>{try{draw();const a=document.createElement('a');a.download='belgardin-'+simKey+'.png';a.href=R.domElement.toDataURL('image/png');a.click();}catch(e){console.warn(e);}};
  const cp=$('#btnLink');if(cp)cp.onclick=()=>{const u=location.href.split('#')[0]+'#sim-'+simKey;(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>{cp.textContent='✓ Скопировано';setTimeout(()=>cp.textContent='🔗 Ссылка',1500);}).catch(()=>{cp.textContent=u;cp.title=u;});};
  document.addEventListener('keydown',e=>{const st=$('#arena-sec');if(!st)return;const r=st.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
    if(e.code=='Space'){e.preventDefault();playing=!playing;syncPlay();}
    else if(e.key=='ArrowRight'){T=Math.min(sim.dur,T+.5);lastT=T;apply();}
    else if(e.key=='ArrowLeft'){T=Math.max(0,T-.5);lastT=T;apply();}
    else if(e.key==']'||e.key=='.')step(0,1);else if(e.key=='['||e.key==',')step(0,-1);
    else if(/^[1-6]$/.test(e.key)){setCam(['orbit','top','iso','boss','player','cine'][+e.key-1]);}
    else if(e.key=='f'||e.key=='F'){$('#btnFull')&&$('#btnFull').click();}});}
function playSim(k){if(!SIMS[k])return;buildSim(k);playing=true;syncPlay();$('#stage').scrollIntoView({behavior:'smooth',block:'center'});}
window.Arena={playSim,buildSim:k=>buildSim(k),get key(){return simKey;},dbg:()=>({R,scene,composer,bloom,fogLayers,envA,envB,party}),seek:t=>{playing=false;syncPlay();T=t;lastT=t;apply();objs.forEach(o=>{if(o.m.material&&o.m.material.uniforms&&o.m.material.uniforms.uT&&o.m.visible)o.m.material.uniforms.uT.value=T;});camTarget(.05);camPos.copy(tmpV);camLook.copy(tmpV2);cam.position.copy(camPos);cam.lookAt(camLook);draw();},step:(t,dt)=>{T=t;apply();if(dt){vfx=vfx.filter(v=>{v.life-=dt*v.rate;if(v.life<=0){scene.remove(v.m);return false;}v.upd(v.m,v.life);return true;});FLASH.forEach(l=>{l.userData.v=Math.max(0,l.userData.v-dt*16);l.intensity=l.userData.v;});}camTarget(.05);camPos.copy(tmpV);camLook.copy(tmpV2);cam.position.copy(camPos);cam.lookAt(camLook);draw();return vfx.length;},view:(m,e,a,d)=>{camMode=m||'orbit';if(e!=null)el=e;if(a!=null)az=a;if(d!=null)dist=d;}};

buildChips();bindUI();
if(init()){let k=(location.hash.match(/sim[=-]([\w]+)/)||[])[1];if(!k||!SIMS[k]){try{k=localStorage.getItem('belg_sim');}catch(e){}}buildSim(SIMS[k]?k:'coffinA');if(!playing){T=sim.dur*.45;apply();}syncPlay();setCam('orbit');}
requestAnimationFrame(loop);
})();
