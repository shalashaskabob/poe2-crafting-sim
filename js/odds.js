/* ============================================================
   ODDS PANEL — the centerpiece
   Determines what the "next add" would be given current omen/floor context,
   shows the full eligible pool, highlights the chosen target mod.
   ============================================================ */
let hoverCtx=null; // {gen, floor, label} set on orb hover; null = derive from state

function deriveAddContext(){
  // What would the next mod-add look like? Prefer hover context.
  if(hoverCtx) return hoverCtx;
  // default: if rare with open slot, show exalt context (random side -> show the side with more relevance)
  if(item.corrupted) return null;
  if(item.rarity==='normal') return {gen:'prefix',floor:0,label:'Transmute would add (random side)',both:true};
  if(item.rarity==='magic'&&modCount()<2){ const gen=!item.prefixes.length?'prefix':'suffix'; return {gen,floor:0,label:'Augment would add here'}; }
  if(item.rarity==='rare'&&modCount()<6){ // exalt context honoring side omens
    if(activeOmens.has('sinExalt')) return {gen:'prefix',floor:0,label:'Exalt → prefix (omen)'};
    if(activeOmens.has('dexExalt')) return {gen:'suffix',floor:0,label:'Exalt → suffix (omen)'};
    return {gen:'prefix',floor:0,label:'Exalt would add (random side)',both:true};
  }
  return null;
}

function renderOdds(){
  const body=document.getElementById('oddsBody');
  const ctx=deriveAddContext();
  if(!ctx){ body.innerHTML=`<div class="odds-empty">${item.corrupted?'Item is corrupted — no further modification.':'No mod-adding action available. Make the item Magic or Rare, or hover an orb that adds a modifier.'}</div>`; return; }

  // If 'both', show combined prefix+suffix as the picture; else one side.
  let groups=[],total=0,sideLabel='';
  if(ctx.both){
    const p=oddsFor('prefix',ctx.floor), s=oddsFor('suffix',ctx.floor);
    // combine: random side means 50/50 between sides then weighted within
    p.groups.forEach(g=>{ g.p=0.5*g.p; });
    s.groups.forEach(g=>{ g.p=0.5*g.p; });
    groups=[...p.groups,...s.groups].sort((a,b)=>b.p-a.p);
    sideLabel=`random side · ${p.groups.length} prefix + ${s.groups.length} suffix families`;
    total=1;
  } else {
    const od=oddsFor(ctx.gen,ctx.floor); groups=od.groups; total=od.total;
    sideLabel=`${ctx.gen} side · ${groups.length} eligible families`;
  }
  if(!groups.length){ body.innerHTML=`<div class="odds-empty">No eligible mods for that side — every family is blocked (already present, or the floor/ilvl excludes them).</div>`; return; }

  // target highlight
  let targetGroup=null;
  if(targetMod){ targetGroup=groups.find(g=>g.ty===targetMod); }

  let html='';
  html+=`<div class="odds-head"><div class="q">If you add a mod now</div><div class="side"><b>${ctx.label}</b> — ${sideLabel}</div></div>`;

  // target selector
  html+=`<div class="targetsel"><label style="font-family:var(--ui);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);display:block;margin-bottom:4px">Track a target mod</label>
    <select id="targetSel"><option value="">— none —</option>`;
  const seen=new Set();
  [...groups].sort((a,b)=>tierLabel(a.m)>tierLabel(b.m)?1:-1).forEach(g=>{ if(seen.has(g.ty))return; seen.add(g.ty);
    html+=`<option value="${g.ty}" ${g.ty===targetMod?'selected':''}>${familyName(g)}</option>`; });
  html+=`</select></div>`;

  if(targetGroup){
    html+=`<div class="oddstarget"><div class="tg">Target chance per add</div>
      <div class="big">${pct(targetGroup.p)}</div>
      <div class="sub">${familyName(targetGroup)} · best tier here: ${tierLabel(targetGroup.m)} (${cleanRange(targetGroup.m.tx)})</div></div>`;
  } else if(targetMod){
    html+=`<div class="oddstarget"><div class="tg">Target chance per add</div><div class="big">0%</div>
      <div class="sub">That mod can't roll on this side/base right now.</div></div>`;
  }

  html+=`<div class="oddslist">`;
  groups.slice(0,40).forEach(g=>{
    const isT=g.ty===targetMod;
    html+=`<div class="oddrow ${isT?'istarget':''}">
      <span class="bar"><i style="width:${Math.max(3,Math.round(g.p*100))}%"></i></span>
      <span class="pc">${pct(g.p)}</span>
      <span class="nm" title="${familyName(g)}">${familyName(g)}</span>
      <span class="tr">${tierLabel(g.m)}</span></div>`;
  });
  html+=`</div>`;
  html+=`<div class="odds-foot"><span>Σ weight ${Math.round(ctx.both?'—':total)||'—'}</span><span>real datamined weights</span></div>`;
  body.innerHTML=html;
  const ts=document.getElementById('targetSel'); if(ts) ts.onchange=()=>{ targetMod=ts.value||null; renderOdds(); };
}
function pct(p){ if(p>=0.1) return (p*100).toFixed(1)+'%'; if(p>=0.001) return (p*100).toFixed(2)+'%'; return (p*100).toFixed(3)+'%'; }
function familyName(g){ // human family name from the best mod's text, stripped of values
  return cleanRange(g.m.tx).replace(/\n/g,' / ').replace(/^[+]?/,'').replace(/\s*\(.*?\)\s*/g,' ').trim() || g.ty; }
function cleanRange(tx){ return tx.replace(/\((\d+)-(\d+)\)/g,(m,a,b)=>`${a}–${b}`); }
function tierLabel(m){ const idx=TIERS[m.ty]?TIERS[m.ty].indexOf(modKeyOf(m)):-1; return idx>=0?`T${idx+1}`:'—'; }
function modKeyOf(m){ // m is a MODS entry; find its key (cache)
  if(m._k) return m._k;
  for(const k in MODS){ if(MODS[k]===m){ m._k=k; return k; } } return null; }

