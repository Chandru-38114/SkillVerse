export function initLanding(gsap, ScrollTrigger, Lenis) {
  var _listeners = [], _tickers = [], _lenis = null, _alive = {v:true};
  function on(t, ev, fn, o){ t.addEventListener(ev, fn, o); _listeners.push([t,ev,fn,o]); return fn; }
  function addTicker(fn){ gsap.ticker.add(fn); _tickers.push(fn); return fn; }
  function cleanup(){
    _alive.v = false;
    try { _listeners.forEach(function(l){ l[0].removeEventListener(l[1], l[2], l[3]); }); } catch(e){}
    try { _tickers.forEach(function(fn){ gsap.ticker.remove(fn); }); } catch(e){}
    try { ScrollTrigger.getAll().forEach(function(t){ t.kill(); }); } catch(e){}
    try { if (_lenis) _lenis.destroy(); } catch(e){}
    try { gsap.globalTimeline.clear(); } catch(e){}
    try { document.body.classList.remove('is-dark'); } catch(e){}
    try { var p = document.querySelector('.pre'); if (p) p.remove(); } catch(e){}
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(gsap && ScrollTrigger);
  var $ = function(s,r){return (r||document).querySelector(s)}, $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

  /* ---------- static builds ---------- */
  var words = $('#words'), HI = ['talk','back.','exact','bug','already','know.'];
  words.innerHTML = words.textContent.trim().split(/\s+/).map(function(w){ return '<span class="w'+(HI.indexOf(w)>-1?' hi':'')+'">'+w+'</span>'; }).join(' ');
  var qd=$('#qdots'); for (var i=0;i<22;i++) qd.appendChild(document.createElement('i'));
  var MS=[[100,'Getting Started'],[200,'Novice Learner'],[500,'Rising Star'],[1000,'SkillVerse Expert'],[5000,'SkillVerse Legend']];
  MS.forEach(function(m,i){ var s=document.createElement('div'); s.className='step'; s.style.height=(70+i*42)+'px'; s.innerHTML='<b>'+m[0]+' XP</b><span>'+m[1]+'</span>'; $('#ladder').appendChild(s); });
  var pts=[]; for (var k=0;k<48;k++){ var r=k%2?40:47, a=Math.PI*k/24; pts.push((50+Math.cos(a)*r).toFixed(1)+','+(50+Math.sin(a)*r).toFixed(1)); } $('#burst').setAttribute('points',pts.join(' '));
  var Q='1110111100100110111011010001101011101110101100000111'; Q.slice(0,49).split('').forEach(function(c){ var e=document.createElement('i'); if(c==='0') e.className='o'; $('#qr').appendChild(e); });
  [8,14,20,12,18,24,10,16,22,14,8,18].forEach(function(h){ var s=document.createElement('span'); s.style.cssText='width:3px;height:'+h+'px;border-radius:2px;background:#29251F'; $('#wave').appendChild(s); });

  /* ---------- hero network ("living video") ---------- */
  var cv=$('#net'), cx=cv.getContext('2d'), nodes=[], dpr=Math.min(2,window.devicePixelRatio||1), mouse={x:-999,y:-999}, netOn=true;
  function sizeNet(){ cv.width=cv.offsetWidth*dpr; cv.height=cv.offsetHeight*dpr; nodes=[]; var n=Math.round(cv.offsetWidth/30); for(var i=0;i<n;i++) nodes.push({x:Math.random()*cv.width,y:Math.random()*cv.height,vx:(Math.random()-.5)*.3*dpr,vy:(Math.random()-.5)*.3*dpr,c:Math.random()<.2}); }
  function drawNet(){
    cx.clearRect(0,0,cv.width,cv.height); var L=150*dpr;
    for (var i=0;i<nodes.length;i++){ var a=nodes[i];
      if(!reduce){ a.x+=a.vx; a.y+=a.vy; var mx=a.x-mouse.x*dpr, my=a.y-mouse.y*dpr, md=Math.sqrt(mx*mx+my*my); if(md<120*dpr){ a.x+=mx/md*1.2; a.y+=my/md*1.2; } }
      if(a.x<0||a.x>cv.width) a.vx*=-1; if(a.y<0||a.y>cv.height) a.vy*=-1;
      for (var j=i+1;j<nodes.length;j++){ var b=nodes[j], dx=a.x-b.x, dy=a.y-b.y, d=Math.sqrt(dx*dx+dy*dy); if(d<L){ cx.strokeStyle='rgba(255,138,61,'+(0.34*(1-d/L)).toFixed(3)+')'; cx.lineWidth=1.2*dpr; cx.beginPath(); cx.moveTo(a.x,a.y); cx.lineTo(b.x,b.y); cx.stroke(); } } }
    nodes.forEach(function(a){ cx.fillStyle=a.c?'#FF8A3D':'rgba(255,253,248,.72)'; cx.beginPath(); cx.arc(a.x,a.y,(a.c?3.4:1.8)*dpr,0,7); cx.fill(); });
    if(!reduce && netOn && _alive.v) requestAnimationFrame(drawNet);
  }
  sizeNet(); drawNet();
  on(window, 'resize', function(){ sizeNet(); if(reduce) drawNet(); });
  $('#hero').addEventListener('pointermove', function(e){ var r=cv.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; });

  /* ---------- final states for reduced motion / no gsap ---------- */
  function finalStates(){
    $$('.words .w').forEach(function(w){w.style.opacity=1});
    $('#score').textContent='78%'; $('#ring').style.background='conic-gradient(var(--acc) 0 78%, var(--lift) 78% 100%)';
    $$('.mast .bar i').forEach(function(b){ b.style.transform='scaleX('+b.dataset.w+')'; });
    $('#xp').innerHTML='620<small>XP</small>'; $$('.stages .fill').forEach(function(f,i){ if(i<3) f.style.transform='scaleX(1)'; });
    $$('.step').forEach(function(s,i){ s.style.background=i<3?'var(--mint)':(i===3?'var(--acc)':'var(--surface)'); });
    $('#jline').style.transform='scaleX(1)'; $$('.qdots i').forEach(function(d,i){ d.className=i<21?'done':'cur'; }); $('#qn').textContent='22';
    $$('#exam .opt')[1].classList.add('on');
  }
  if (reduce || !hasGsap){
    finalStates();
    $$('#journey .jtrack,#rtrack').forEach(function(t){ t.style.flexWrap='wrap'; t.style.paddingRight='var(--gut)'; });
    return cleanup;
  }

  /* ---------- smooth scroll ---------- */
  gsap.registerPlugin(ScrollTrigger);
  var lenis = Lenis ? new Lenis({ lerp:0.085, wheelMultiplier:1, smoothWheel:true }) : null; _lenis = lenis;
  if (lenis){ lenis.on('scroll', ScrollTrigger.update); addTicker(function(t){ lenis.raf(t*1000); }); gsap.ticker.lagSmoothing(0); }
  $$('a[href^="#"]').forEach(function(a){ a.addEventListener('click', function(e){ var t=$(a.getAttribute('href')); if(!t) return; e.preventDefault(); lenis ? lenis.scrollTo(t,{duration:1.6,easing:function(x){return 1-Math.pow(1-x,4)}}) : t.scrollIntoView({behavior:'smooth'}); }); });

  /* ---------- preloader ---------- */
  var pre=document.createElement('div'); pre.className='pre'; pre.setAttribute('aria-hidden','true');
  pre.innerHTML='<div class="eb" style="color:var(--cream)">Peer learning · AI-verified skills</div><div><div class="word">'+'SkillVerse'.split('').map(function(c){return '<span>'+c+'</span>'}).join('')+'</div><div class="bar" style="margin-top:22px"><i></i></div></div><div class="count">00</div>';
  document.body.appendChild(pre); if (lenis) lenis.stop();
  var cnt={v:0};
  var intro=gsap.timeline({defaults:{ease:'power4.out'}});
  intro.to($$('.word span',pre),{y:0,duration:.9,stagger:.045})
       .to(cnt,{v:100,duration:1.3,ease:'power2.inOut',onUpdate:function(){ $('.count',pre).textContent=String(Math.round(cnt.v)).padStart(2,'0'); }},0.1)
       .to($('.bar i',pre),{scaleX:1,duration:1.3,ease:'power2.inOut'},0.1)
       .to(pre,{yPercent:-100,duration:1,ease:'expo.inOut'},'+=0.15')
       .from('#heroPhoto',{scale:1.35,duration:1.8,ease:'expo.out'},'-=0.75')
       .from('#hero .line>span',{yPercent:110,duration:1.1,stagger:.12},'-=1.3')
       .from('#hero .pill, #hero .lede, #hero .btn, #hero .h-meta > div',{y:30,opacity:0,duration:.9,stagger:.06},'-=0.8')
       .add(function(){ pre.remove(); if(lenis) lenis.start(); });
  $$('.h-meta b[data-count]').forEach(function(b){ var o={v:0}; intro.to(o,{v:+b.dataset.count,duration:1.2,ease:'power2.out',onUpdate:function(){ b.textContent=Math.round(o.v); }},'-=0.9'); });

  /* ---------- global chrome ---------- */
  gsap.to('#prog',{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:true}});
  ScrollTrigger.create({trigger:'#hero',start:'top top',end:'bottom top',onToggle:function(s){ netOn=s.isActive; if(netOn) drawNet(); }});

  /* masked line reveals for every heading (except hero, done in intro) */
  $$('section:not(#hero) .line>span').forEach(function(el){
    gsap.from(el,{yPercent:110,duration:1.1,ease:'power4.out',scrollTrigger:{trigger:el.closest('h2'),start:'top 85%'}});
  });
  $$('.specs li, .lede:not(#hero .lede), .earn .pill, .rk').forEach(function(el){
    gsap.from(el,{y:28,opacity:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 90%'}});
  });

  /* parallax helpers */
  $$('[data-speed]').forEach(function(el){
    gsap.to(el,{y:+el.dataset.speed,ease:'none',scrollTrigger:{trigger:el.parentElement,start:'top bottom',end:'bottom top',scrub:true}});
  });

  var mm = gsap.matchMedia();
  var wide = window.matchMedia('(min-width:900px)').matches;
  function pinST(trigger,len){ return wide ? {trigger:trigger,start:'top top',end:'+='+len,pin:true,scrub:1} : {trigger:trigger,start:'top 80%',end:'bottom 75%',scrub:1}; }

  /* hero exit */
  gsap.timeline({scrollTrigger:{trigger:'#hero',start:'top top',end:'bottom top',scrub:true}})
    .to('#heroPhoto',{scale:1.25,yPercent:8,ease:'none'},0)
    .to('.hero-in',{yPercent:-18,opacity:0,ease:'none'},0);

  /* manifesto words */
  var W=$$('.words .w');
  gsap.timeline({scrollTrigger:{trigger:'#manifesto',start:'top top',end:'+=140%',pin:true,scrub:1}})
    .to(W,{opacity:1,stagger:.1,ease:'none'});

  /* marquee: auto-scroll + velocity */
  $$('.mq-row').forEach(function(row){
    row.innerHTML += row.innerHTML;
    var dir=+row.dataset.dir, x=0, w=row.scrollWidth/2, vel=0;
    ScrollTrigger.create({start:0,end:'max',onUpdate:function(s){ vel=s.getVelocity()/300; }});
    addTicker(function(){ if(!_alive.v) return; x += dir*(1.1+Math.min(Math.abs(vel),18))*(vel<0?-1:1); vel*=0.92; if(x<=-w) x+=w; if(x>0) x-=w; row.style.transform='translate3d('+x+'px,0,0) skewX('+gsap.utils.clamp(-8,8,-vel*0.6)+'deg)'; });
    on(window, 'resize', function(){ w=row.scrollWidth/2; });
  });

  /* journey: horizontal pin */
  var jt=$('#jtrack');
  function jDist(){ return Math.max(0, jt.scrollWidth - window.innerWidth + 40); }
  gsap.timeline({scrollTrigger:{trigger:'#journey',start:'top top',end:function(){return '+='+(jDist()+window.innerHeight*0.5)},pin:true,scrub:1,invalidateOnRefresh:true}})
    .to(jt,{x:function(){return -jDist()},ease:'none'},0)
    .to('#jline',{scaleX:1,ease:'none'},0)
    .from($$('.jcard .n'),{yPercent:60,opacity:.2,stagger:.06,ease:'none'},0);

  /* arena: pinned exam playback */
  var QD=$$('.qdots i'), st={q:1,t:2700,s:0};
  function paintExam(){ var q=Math.round(st.q); $('#qn').textContent=q; QD.forEach(function(d,i){ d.className=i<q-1?'done':(i===q-1?'cur':''); }); var s=Math.round(st.t), t=$('#timer'); t.textContent='◷ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); t.classList.toggle('low',s<300); $$('#exam .opt')[1].classList.toggle('on', q>6); var sc=Math.round(st.s); $('#score').textContent=sc+'%'; $('#ring').style.background='conic-gradient(var(--acc) 0 '+sc+'%, var(--lift) '+sc+'% 100%)'; }
  paintExam();
  var at=gsap.timeline({scrollTrigger:pinST('#arena','220%')});
  at.from('#exam',{y:80,rotate:4,opacity:0,duration:.6,ease:'power3.out'})
    .to(st,{q:22,t:240,duration:2,ease:'none',onUpdate:paintExam},'>')
    .fromTo('#warn',{x:-40,opacity:0,rotate:-6},{x:0,opacity:1,rotate:-3,duration:.4,ease:'back.out(2)'},'<0.7')
    .to('#warn',{x:-30,opacity:0,duration:.3},'<1')
    .fromTo('#result',{scale:.6,rotate:-8,opacity:0},{scale:1,rotate:0,opacity:1,duration:.5,ease:'back.out(1.6)'},'>')
    .to(st,{s:78,duration:.8,ease:'power2.out',onUpdate:paintExam},'<')
    .to($$('.mast .bar i'),{scaleX:function(i,el){return +el.dataset.w},duration:.6,stagger:.12,ease:'power3.out'},'<0.2');

  /* match */
  mm.add({wide:'(min-width:900px)',narrow:'(max-width:899px)'},function(c){
    var far=c.conditions.wide?260:120;
    gsap.timeline({scrollTrigger:pinST('#match','160%')})
      .from('#pA',{x:-far,rotate:-12,opacity:0,ease:'power3.out',duration:1},0)
      .from('#pB',{x:far,rotate:12,opacity:0,ease:'power3.out',duration:1},0)
      .from('#swap',{scale:0,rotate:-180,ease:'back.out(2)',duration:.6},.7)
      .from('#stamp',{scale:2.2,opacity:0,rotate:-14,ease:'power4.in',duration:.35},1.25)
      .to('#pA',{rotate:-2,duration:.3},1.3).to('#pB',{rotate:2,duration:.3},1.3)
      .from($$('#ranked .bar i'),{scaleX:0,stagger:.12,duration:.6,ease:'power2.out'},.2);
  });

  /* chat playback */
  var bubbles=$$('#msgs > *');
  gsap.set(bubbles,{opacity:0,y:20,scale:.96});
  gsap.timeline({scrollTrigger:pinST('#chat','170%')})
    .from('#phone',{y:120,rotate:3,opacity:0,duration:.6,ease:'power3.out'})
    .to(bubbles,{opacity:1,y:0,scale:1,stagger:.4,duration:.35,ease:'back.out(1.6)'});

  /* room: horizontal tools */
  var rt=$('#rtrack');
  function rDist(){ return Math.max(0, rt.scrollWidth - window.innerWidth + 40); }
  var rtl=gsap.timeline({scrollTrigger:{trigger:'#room',start:'top top',end:function(){return '+='+(rDist()+window.innerHeight*0.6)},pin:true,scrub:1,invalidateOnRefresh:true}});
  rtl.to(rt,{x:function(){return -rDist()},ease:'none'},0).to('#roomPhoto',{xPercent:-6,scale:1.12,ease:'none'},0);
  $$('.draw').forEach(function(p){ var L=p.getTotalLength?p.getTotalLength():600; gsap.fromTo(p,{strokeDasharray:L,strokeDashoffset:L},{strokeDashoffset:0,ease:'none',scrollTrigger:{trigger:'#room',start:'top top',end:'+=90%',scrub:1}}); });

  /* grow */
  var xp={v:0}, STEPS=$$('.step');
  function paintXp(){ var v=Math.round(xp.v); $('#xp').innerHTML=v+'<small>XP</small>'; var nextI=MS.findIndex(function(m){return v<m[0]}); STEPS.forEach(function(s,i){ s.style.background=v>=MS[i][0]?'var(--mint)':(i===nextI?'var(--acc)':'var(--surface)'); }); }
  gsap.timeline({scrollTrigger:pinST('#grow','170%')})
    .from(STEPS,{scaleY:.1,stagger:.12,duration:.6,ease:'power3.out'},0)
    .to(xp,{v:620,duration:1.4,ease:'none',onUpdate:paintXp},0.2)
    .to($$('.stages .fill').slice(0,3),{scaleX:1,stagger:.3,duration:.4,ease:'none'},0.2)
    .from($$('.stages > div'),{y:20,opacity:0,stagger:.08,duration:.4},0);

  /* proof */
  gsap.timeline({scrollTrigger:pinST('#proof','170%')})
    .from('#cert',{rotateX:62,y:90,opacity:.2,duration:1,ease:'power3.out'})
    .from('#seal',{scale:2.6,rotate:-60,opacity:0,duration:.35,ease:'power4.in'},'>')
    .fromTo('#scanline',{top:'0%',opacity:1},{top:'100%',opacity:1,duration:.6,ease:'none'},'>0.1')
    .to('#scanline',{opacity:0,duration:.1})
    .from('#verify',{y:30,scale:.9,opacity:0,duration:.35,ease:'back.out(2)'},'<');

  /* stack + roadmap */
  gsap.from('.layer',{y:120,opacity:0,rotate:function(i){return [-4,3,-2,4][i]},stagger:.12,duration:1.1,ease:'power4.out',scrollTrigger:{trigger:'.stack',start:'top 85%'}});
  gsap.from('.arch',{y:40,opacity:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:'.arch',start:'top 90%'}});
  gsap.from('.rm',{y:60,opacity:0,stagger:.1,duration:.9,ease:'power3.out',scrollTrigger:{trigger:'.road',start:'top 88%'}});

  /* cursor + magnetic buttons (desktop only) */
  mm.add('(hover:hover) and (pointer:fine)',function(){
    var cur=$('#cur'), xTo=gsap.quickTo(cur,'x',{duration:.35,ease:'power3'}), yTo=gsap.quickTo(cur,'y',{duration:.35,ease:'power3'});
    function mv(e){ xTo(e.clientX); yTo(e.clientY); }
    on(window, 'pointermove', mv);
    $$('a,button,.card').forEach(function(el){ el.addEventListener('pointerenter',function(){ cur.classList.add('big'); }); el.addEventListener('pointerleave',function(){ cur.classList.remove('big'); }); });
    $$('.mag').forEach(function(b){
      var bx=gsap.quickTo(b,'x',{duration:.5,ease:'elastic.out(1,.4)'}), by=gsap.quickTo(b,'y',{duration:.5,ease:'elastic.out(1,.4)'});
      b.addEventListener('pointermove',function(e){ var r=b.getBoundingClientRect(); bx((e.clientX-r.left-r.width/2)*.3); by((e.clientY-r.top-r.height/2)*.4); });
      b.addEventListener('pointerleave',function(){ bx(0); by(0); });
    });
    return function(){ window.removeEventListener('pointermove',mv); };
  });

  var chaps=$$('[data-chap]');
  chaps.forEach(function(s,i){
    ScrollTrigger.create({trigger:(s.parentElement && s.parentElement.classList.contains('pin-spacer'))?s.parentElement:s,start:'top 50%',end:'bottom 50%',
      onToggle:function(self){ if(!self.isActive) return; document.body.classList.toggle('is-dark', s.hasAttribute('data-dark')); $('#chapN').textContent=String(i).padStart(2,'0'); $('#chapL').textContent=s.dataset.chap; },
      onUpdate:function(self){ $('#chapBar').style.setProperty('--cp', self.progress.toFixed(3)); }});
  });
  on(window, 'load', function(){ ScrollTrigger.refresh(); });
  return cleanup;
}
