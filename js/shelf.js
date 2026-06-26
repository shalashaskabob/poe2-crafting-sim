/* ---- hovered-item tooltip ---- */
let tipEl;
function ensureTip(){ if(!tipEl){ tipEl=document.createElement('div'); tipEl.className='invtip'; document.body.appendChild(tipEl); } return tipEl; }
function showTip(name,desc,cost,color){ const t=ensureTip();
  t.innerHTML=`<div class="tname" style="color:${color||'#e9e0cf'}">${name||''}</div>`+
    `<div class="tbody">${desc||''}${cost?`<div class="tcost">Cost ≈ ${cost} ex</div>`:''}</div>`;
  t.classList.add('show'); }
function moveTip(e){ if(!tipEl)return; const pad=15, r=tipEl.getBoundingClientRect();
  let x=e.clientX+pad, y=e.clientY+pad;
  if(x+r.width>innerWidth-8) x=e.clientX-r.width-pad;
  if(y+r.height>innerHeight-8) y=innerHeight-r.height-8;
  tipEl.style.left=Math.max(8,x)+'px'; tipEl.style.top=Math.max(8,y)+'px'; }
function hideTip(){ if(tipEl)tipEl.classList.remove('show'); }

function escA(s){ return (''+s).replace(/"/g,'&quot;'); }
const IMG_DIR='img/';
const CUR_IMG={transmute:'transmute.webp',aug:'aug.webp',regal:'regal.webp',alch:'alch.webp',exalt:'exalt.webp',
  chaos:'chaos.webp',annul:'annul.webp',divine:'divine.webp',fracture:'fracture.webp',vaal:'vaal.webp'};
const ESS_IMG={life:'ess_life.webp',mana:'ess_mana.webp',fireres:'ess_fire.webp',coldres:'ess_cold.webp',
  lightres:'ess_light.webp',chaosres:'ess_chaos.webp',phys:'ess_phys.webp',attackspd:'ess_speed.webp',spelldmg:'ess_caster.webp'};
function invCell(o){ // {attrs,img,color,cost,tier,ok,name,desc}
  const tg=o.tier==='Greater'?'<span class="tg g">G</span>':o.tier==='Perfect'?'<span class="tg p">P</span>':'';
  return `<button class="cell${o.ok?'':' dis'}" ${o.attrs} ${o.ok?'':'aria-disabled="true"'} `+
    `data-nm="${escA(o.name)}" data-ds="${escA(o.desc)}" data-cost="${escA(o.cost||'')}" data-color="${o.color}">`+
    `<img src="${(typeof IMG_DATA!=='undefined'&&IMG_DATA[o.img])||IMG_DIR+o.img}" alt="" loading="lazy" draggable="false">${tg}`+
    `${o.cost?`<span class="cost">${o.cost}</span>`:''}</button>`;
}

function renderShelf(){
  const shelf=document.getElementById('shelf');
  const cells=[];
  // all currency (Rarity, Modifier, Corruption — in source order)
  CUR.forEach(c=>{ cells.push(invCell({attrs:`data-cur="${c.id}"`,img:CUR_IMG[c.base]||'transmute.webp',
    color:c.color,cost:c.cost,tier:c.tier,ok:c.can(),name:c.name,desc:c.desc})); });
  // essences — one cell each, auto-tiered by item rarity (Greater on Magic, Perfect on Rare)
  ESSENCE_DEFS.forEach(e=>{ const elig=essenceGroupEligible(e)&&!item.corrupted&&!item.hasCrafted&&curBase().c!=='Jewel';
    const pOk=elig&&item.rarity==='rare', gOk=elig&&item.rarity==='magic', ok=pOk||gOk;
    const tier=pOk?'Perfect':gOk?'Greater':'';
    const desc=pOk?'Perfect Essence — on a Rare: removes a random mod, adds this guaranteed mod.'
      :gOk?'Greater Essence — upgrades Magic → Rare with this guaranteed mod.'
      :'Needs a Magic item (Greater) or a Rare item (Perfect). One crafted mod per item.';
    cells.push(invCell({attrs:`data-ess="${e.id}" data-p="${pOk?1:0}"`,img:ESS_IMG[e.id]||'ess_life.webp',
      color:'#c071d8',cost:pOk?15:5,tier,ok,name:e.name,desc})); });
  // desecration
  const boneOk=item.rarity==='rare'&&!item.corrupted&&!item.hasDesec&&!pendingReveal&&curBase().c!=='Jewel';
  cells.push(invCell({attrs:`id="boneBtn"`,img:'bone.webp',color:'#6fd8a0',cost:8,ok:boneOk,
    name:'Preserved Bone',desc:'Adds a hidden Desecrated (Lich) mod — reveal and pick 1 of 3.'}));
  // quality & sockets
  const qOk=item.rarity!=='normal'&&!item.corrupted&&item.quality<20&&curBase().c!=='Jewel';
  const max=SOCKETS[curBase().c]||0; const sOk=!item.corrupted&&item.sockets<max&&max>0;
  cells.push(invCell({attrs:`id="qualBtn"`,img:'quality.webp',color:'#bcd87a',cost:1,ok:qOk,
    name:"Whetstone / Armourer's Scrap",desc:'+5% Quality (cap 20%). Quality boosts mod magnitudes — apply before Divine.'}));
  if(max>0)cells.push(invCell({attrs:`id="sockBtn"`,img:'socket.webp',color:'#cfcfcf',cost:2,ok:sOk,
    name:"Artificer's Orb",desc:`Adds a socket (max ${max} on this base type).`}));
  shelf.innerHTML=`<div class="stash"><div class="invgrid">${cells.join('')}</div></div>`;
  // pad with empty quatrefoil slots to complete the last row + one spare row (PoE2 inventory look)
  const grid=shelf.querySelector('.invgrid');
  const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const rem=(cols-(cells.length%cols))%cols; let pad='';
  for(let i=0;i<rem+cols;i++) pad+='<div class="cell empty"></div>';
  grid.insertAdjacentHTML('beforeend',pad);

  // tooltip on every item cell (works on disabled cells too, so names are always discoverable)
  shelf.querySelectorAll('.cell[data-nm]').forEach(el=>{
    el.addEventListener('mouseenter',ev=>{ showTip(el.dataset.nm,el.dataset.ds,el.dataset.cost,el.dataset.color); moveTip(ev); });
    el.addEventListener('mousemove',moveTip);
    el.addEventListener('mouseleave',hideTip); });

  shelf.querySelectorAll('.cell[data-cur]').forEach(btn=>{ const c=CUR.find(x=>x.id===btn.dataset.cur);
    btn.onclick=()=>{ hideTip(); hoverCtx=null; runCurrency(c); };
    btn.onmouseenter=()=>{ if(!c.can())return; setHoverFromCurrency(c); document.getElementById('predict').innerHTML=`<b>${c.name}:</b> ${c.predict()}`; };
    btn.onmouseleave=()=>{ hoverCtx=null; renderOdds(); }; });
  shelf.querySelectorAll('.cell[data-ess]').forEach(btn=>{ const e=ESSENCE_DEFS.find(x=>x.id===btn.dataset.ess);
    btn.onclick=()=>{ if(btn.classList.contains('dis')){ toast("Can't use that essence now"); return; }
      hideTip(); pushHist(); const l=applyEssence(e,btn.dataset.p==='1'); spent+=(btn.dataset.p==='1'?15:5); pushLessons(l); render(); };
    btn.onmouseenter=()=>{ if(btn.classList.contains('dis'))return; const side=essenceSide(e.ty);
      hoverCtx={gen:side,floor:btn.dataset.p==='1'?50:35,label:`${e.name} guarantees its mod (${side})`}; targetMod=e.ty; renderOdds(); };
    btn.onmouseleave=()=>{ hoverCtx=null; renderOdds(); }; });
  const bb=document.getElementById('boneBtn'); if(bb)bb.onclick=()=>{ if(bb.classList.contains('dis')){ toast("Can't desecrate now"); return; } hideTip(); pushHist(); const l=applyBone(); spent+=8; pushLessons(l); render(); };
  const qb=document.getElementById('qualBtn'); if(qb)qb.onclick=()=>{ hideTip(); applyQuality(); };
  const sb=document.getElementById('sockBtn'); if(sb)sb.onclick=()=>{ hideTip(); addSocket(); };
  document.getElementById('predict').innerHTML='Hover an orb to preview it and see live odds.';
}
function setHoverFromCurrency(c){
  // determine the add-context this orb implies, for the odds panel
  if(c.base==='transmute'){ hoverCtx={gen:'prefix',floor:c.floor,label:`${c.name} adds (random side)`,both:true}; }
  else if(c.base==='aug'){ const gen=!item.prefixes.length?'prefix':'suffix'; hoverCtx={gen,floor:c.floor,label:`${c.name} fills the open ${gen}`}; }
  else if(c.base==='regal'){ const gen=activeOmens.has('sinCoron')?'prefix':activeOmens.has('dexCoron')?'suffix':null;
    hoverCtx=gen?{gen,floor:c.floor,label:`${c.name} → ${gen} (omen)`}:{gen:'prefix',floor:c.floor,label:`${c.name} adds (random side)`,both:true}; }
  else if(c.base==='exalt'){ const gen=activeOmens.has('sinExalt')?'prefix':activeOmens.has('dexExalt')?'suffix':null;
    hoverCtx=gen?{gen,floor:c.floor,label:`${c.name} → ${gen} (omen)`}:{gen:'prefix',floor:c.floor,label:`${c.name} adds (random side)`,both:true}; }
  else if(c.base==='chaos'){ hoverCtx={gen:'prefix',floor:c.floor,label:`${c.name} adds a new mod (random side)`,both:true}; }
  else if(c.base==='alch'){ hoverCtx={gen:'prefix',floor:0,label:`${c.name} adds 4 mods`,both:true}; }
  else hoverCtx=null;
  renderOdds();
}

