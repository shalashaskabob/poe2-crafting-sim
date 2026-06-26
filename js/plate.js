/* ============================================================
   RENDER
   ============================================================ */
function render(){
  if(!item) return;
  const b=curBase();
  const plate=document.getElementById('plate'); plate.className='plate rarity-'+item.rarity;
  const inner=document.getElementById('plateInner');
  let nameLine = item.rarity==='rare'?rareName():item.rarity==='magic'?magicName():b.c+' — '+item.base;
  let html=`<div class="itemname">${item.rarity==='normal'?item.base:nameLine}</div>`;
  if(item.rarity==='rare') html+=`<div class="itembase">${item.base}</div>`;
  html+=`<div class="itemmeta">${b.c} · ilvl <b>${item.ilvl}</b></div>`;
  if((b.i&&b.i.length)||item.vaalImplicit||(item.impLines&&item.impLines.length)){ html+=`<div class="sep"></div>`;
    var _impl=(!window.__altRange && item.impLines && item.impLines.length) ? item.impLines : (b.i||[]);
    _impl.forEach(t=>html+=`<div class="implicit">${t}</div>`);
    if(item.vaalImplicit)html+=`<div class="implicit" style="color:var(--corrupt)">${item.vaalImplicit}</div>`; }
  html+=`<div class="sep"></div><div class="affixrails">
    <div class="rail"><h4>Prefixes ${item.prefixes.length}/${maxAff()}</h4>${rail('prefix')}</div>
    <div class="rail"><h4>Suffixes ${item.suffixes.length}/${maxAff()}</h4>${rail('suffix')}</div></div>`;
  html+=`<div class="badge-row">`;
  if(item.quality>0)html+=`<span class="badge qual">Quality ${item.quality}%</span>`;
  for(let i=0;i<item.sockets;i++)html+=`<span class="badge">◇ socket</span>`;
  if(item.sanctified)html+=`<span class="badge sanct">Sanctified</span>`;
  if(item.corrupted)html+=`<span class="badge corrupt">Corrupted</span>`;
  html+=`</div>`;
  if(pendingReveal)html+=revealWell();
  inner.innerHTML=html;
  if(pendingReveal){ pendingReveal.offer.forEach((m,i)=>{ const e=document.getElementById('rev'+i); if(e)e.onclick=()=>revealDesec(i); });
    const rr=document.getElementById('revRoll'); if(rr)rr.onclick=rerollReveal; }

  document.getElementById('modcount').textContent=`${modCount()} / ${maxAff()*2}`;
  document.getElementById('rarityState').textContent=item.rarity[0].toUpperCase()+item.rarity.slice(1);
  document.getElementById('spent').textContent=spent;
  document.getElementById('dataVer').textContent='data '+DATA.version;
  renderShelf(); renderOmens(); renderOdds();
}
function rail(gen){
  const arr=gen==='prefix'?item.prefixes:item.suffixes; let out='';
  for(let i=0;i<maxAff();i++){ const m=arr[i];
    if(!m){ out+=`<div class="slot empty"><div class="slotlabel">empty ${gen}</div></div>`; continue; }
    let cls='slot filled'; if(m.fractured)cls+=' frac'; if(m.crafted)cls+=' crafted'; if(m.desecrated)cls+=' desec';
    let meta='';
    if(m.desecrated){ meta=`<span style="font-family:var(--ui);color:var(--desecrated)">Desecrated · ${m.lich}</span>`; }
    else { const tc=m.rank===1?'t1':m.rank===2?'t2':'tx'; meta=`<span class="tier ${tc}">T${m.rank}</span>`;
      meta+=(m.tg||[]).slice(0,3).map(t=>`<span class="mtag">${t}</span>`).join('');
      if(m.crafted)meta=`<span style="font-family:var(--ui);font-size:9px;color:#7fa6e0">Crafted</span>`+meta; }
    out+=`<div class="${cls}"><div class="mtext">${m.desecrated?m.dtext:modText(m)}</div><div class="mmeta">${meta}</div></div>`;
  }
  return out;
}
function revealWell(){
  let h=`<div class="sep"></div><div style="text-align:center;font-family:var(--ui);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--desecrated);margin:6px 0 8px">⸸ Well of Souls — choose one</div><div style="display:flex;flex-direction:column;gap:6px;padding:0 6px">`;
  pendingReveal.offer.forEach((m,i)=>{ h+=`<button id="rev${i}" class="btn sm" style="text-align:left;border-color:var(--desecrated);color:#bfe8cd">${m.tx} <span style="color:var(--ink-faint);font-size:10px">· ${m.lich} · ${m.g}</span></button>`; });
  h+=`</div>`;
  if(pendingReveal.canReroll&&!pendingReveal.used)h+=`<div style="text-align:center;margin-top:8px"><button id="revRoll" class="btn sm">✦ Abyssal Echoes: reroll</button></div>`;
  return h;
}
function rareName(){ const pre=['Vortex','Brood','Dread','Gloom','Hypnotic','Carrion','Empyrean','Morbid','Rapture','Doom'];
  const suf=['Bane','Whorl','Shroud','Grip','Wound','Knell','Veil','Husk','Crest','Sorrow'];
  if(!item.rname)item.rname=pick(pre)+' '+pick(suf); return item.rname; }
function magicName(){ const m=allMods(); const adj=m.find(x=>(x.tg||[]).includes('life'))?'Healthy':m.find(x=>(x.tg||[]).includes('resistance'))?'Resistant':m.find(x=>(x.tg||[]).includes('damage'))?'Honed':'Fettered'; return adj+' '+item.base; }

function shade(hex,amt){ let c=hex.replace('#',''); if(c.length===3)c=c.split('').map(x=>x+x).join('');
  let n=parseInt(c,16),r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0'); }

