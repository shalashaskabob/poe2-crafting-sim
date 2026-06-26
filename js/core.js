/* ============================================================
   DATA: injected as window.POE2_DATA (real datamined weights,
   0.4 base + 0.5 deltas). Schema:
   POE2_DATA = {version, weights_patch, sockets:{class->n},
     bases:{name->{c:class, t:[tags], d:droplevel, i:[implicit text]}},
     mods:{key->{n:affixName, tx:text, g:'prefix'|'suffix', ty:tierGroup,
            gr:[groups], rl:reqlevel, tg:[tags], sw:[[tag,weight]], st:[{mn,mx}], es:essenceOnly}},
     tiers:{tierGroup->[modKeys sorted best-first]}}
   ============================================================ */
const DATA = window.POE2_DATA;
if(window.JEWEL_DATA){ Object.assign(DATA.bases,JEWEL_DATA.bases); Object.assign(DATA.mods,JEWEL_DATA.mods); Object.assign(DATA.tiers,JEWEL_DATA.tiers); }
const BASES = DATA.bases, MODS = DATA.mods, TIERS = DATA.tiers, SOCKETS = DATA.sockets;

/* ---------- RNG (seeded) ---------- */
let SEED=(Math.random()*1e9)|0;
function rng(){ SEED=(SEED*1664525+1013904223)&0x7fffffff; return SEED/0x7fffffff; }
function pick(a){ return a[Math.floor(rng()*a.length)]; }

/* ---------- core weight resolution (exactly like the game) ----------
   A mod's weight on a base = the FIRST spawn_weight entry whose tag the base
   carries; weight 0 excludes the base even if a broader later tag would match. */
function weightOnBase(modKey, baseTags){
  const sw = MODS[modKey].sw;
  for(const [tag,w] of sw){ if(baseTags.has(tag)) return w; }
  return 0;
}

/* item state */
let item=null, history=[], spent=0, activeOmens=new Set(), pendingReveal=null, targetMod=null;

function curBase(){ return BASES[item.base]; }
function baseTagSet(){ return new Set(curBase().t); }
function allMods(){ return [...item.prefixes,...item.suffixes]; }
function modCount(){ return item.prefixes.length+item.suffixes.length; }
function maxAff(){ return curBase().c==='Jewel'?2:3; }
function openP(){ return item.prefixes.length<maxAff(); }
function openS(){ return item.suffixes.length<maxAff(); }
function presentGroups(){ const s=new Set(); for(const m of allMods()) for(const g of m.gr) s.add(g); return s; }

function newItem(baseName, ilvl){
  item={ base:baseName, ilvl:Math.max(1,Math.min(86,ilvl|0)), rarity:'normal', quality:0,
    sockets:0, corrupted:false, sanctified:false, vaalImplicit:null,
    prefixes:[], suffixes:[], hasCrafted:false, hasDesec:false, rname:null };
  history=[]; spent=0; pendingReveal=null; activeOmens.clear();
  render();
}
function snap(){ return JSON.stringify(item); }
function pushHist(){ history.push(snap()); if(history.length>50) history.shift(); }
function undo(){ if(!history.length){ toast('Nothing to undo'); return; } item=JSON.parse(history.pop()); render(); }

/* ---------- eligibility & odds ----------
   eligible(gen, floor): list of {key, w} mod-tiers that could roll right now.
   We resolve to one tier per group for probability display (the game picks a
   mod by summed group weight, then a tier within—but tiers of a group are the
   same "mod", so for FAMILY odds we sum the group's eligible-tier weights). */
function eligibleTiers(gen, floor){
  const tags=baseTagSet(); const pg=presentGroups(); const out=[];
  for(const key in MODS){
    const m=MODS[key];
    if(m.g!==gen || m.es) continue;
    if(m.rl>item.ilvl) continue;
    if(floor && m.rl<floor){
      // floor never empties a family: allow if this is the family's only option ≤ilvl.
      // We handle that at group level below; for now skip, then patch.
      continue;
    }
    if(m.gr.some(g=>pg.has(g))) continue;
    const w=weightOnBase(key,tags);
    if(w>0) out.push({key,w});
  }
  // Floor family-rescue: for any group that got fully excluded by the floor but
  // HAS an eligible tier ≤ilvl (ignoring floor), add back its highest tier.
  if(floor){
    const haveGroups=new Set(out.map(o=>MODS[o.key].ty));
    const tags2=tags;
    for(const ty in TIERS){
      if(haveGroups.has(ty)) continue;
      // any tier of this group eligible ignoring floor?
      const cand=TIERS[ty].filter(k=>{
        const m=MODS[k]; return m.g===gen && !m.es && m.rl<=item.ilvl &&
          !m.gr.some(g=>presentGroups().has(g)) && weightOnBase(k,tags2)>0;
      });
      if(cand.length){ const best=cand[0]; out.push({key:best,w:weightOnBase(best,tags2)}); }
    }
  }
  return out;
}

/* group the eligible tiers into families for odds display */
function oddsFor(gen, floor){
  const tiers=eligibleTiers(gen,floor);
  const byGroup={};
  for(const {key,w} of tiers){
    const ty=MODS[key].ty;
    if(!byGroup[ty]) byGroup[ty]={ty, w:0, best:key};
    byGroup[ty].w+=w;
    // best = highest-tier (first in TIERS order) eligible
    if(TIERS[ty].indexOf(key)<TIERS[ty].indexOf(byGroup[ty].best)) byGroup[ty].best=key;
  }
  const groups=Object.values(byGroup);
  const total=groups.reduce((s,g)=>s+g.w,0)||1;
  groups.forEach(g=>{ g.p=g.w/total; g.m=MODS[g.best]; });
  groups.sort((a,b)=>b.w-a.w);
  return {groups,total};
}

/* roll a concrete tier within a group, respecting floor & ilvl, weighted */
function rollGroupTier(ty, floor){
  const tags=baseTagSet();
  let cand=TIERS[ty].filter(k=>{ const m=MODS[k];
    return m.rl<=item.ilvl && (!floor||m.rl>=floor) && weightOnBase(k,tags)>0; });
  if(!cand.length){
    // No tier of this family reaches the floor (it tops out below the floor level).
    // Mirror the family-rescue in eligibleTiers: hand back the BEST available tier,
    // NOT a weighted roll across all tiers — that would give a high-tier orb (Greater/
    // Perfect) the weakest low-tier mod, which is what produced the bogus "T23 +10 Mana".
    const elig=TIERS[ty].filter(k=>MODS[k].rl<=item.ilvl && weightOnBase(k,tags)>0);
    return elig.length ? elig[0] : TIERS[ty][TIERS[ty].length-1];
  }
  // weight by tier (each tier has its own weight on the base)
  let tot=0; const ws=cand.map(k=>{ const w=weightOnBase(k,tags)||1; tot+=w; return w; });
  let r=rng()*tot; let chosen=cand[0];
  for(let i=0;i<cand.length;i++){ r-=ws[i]; if(r<=0){ chosen=cand[i]; break; } }
  return chosen;
}

/* make a mod instance from a mod key (rolls values) */
function makeInst(key, flags){
  const m=MODS[key];
  const vals=m.st.map(s=>s.mn+Math.floor(rng()*(s.mx-s.mn+1)));
  // tier rank: index in its TIERS group (1 = best)
  const rank=(TIERS[m.ty]?TIERS[m.ty].indexOf(key):0)+1;
  return {key, ty:m.ty, g:m.g, gr:m.gr, tg:m.tg, rl:m.rl, vals, rank,
    crafted:!!(flags&&flags.crafted), desecrated:!!(flags&&flags.desecrated),
    fractured:false, lich:(flags&&flags.lich)||null};
}

/* add a random mod by rolling a group then a tier */
function addRandomMod(gen, floor, flags){
  const od=oddsFor(gen,floor);
  if(!od.groups.length) return null;
  // weighted group pick
  let r=rng()*od.total, chosen=od.groups[0];
  for(const g of od.groups){ r-=g.w; if(r<=0){ chosen=g; break; } }
  const tierKey=rollGroupTier(chosen.ty,floor);
  const inst=makeInst(tierKey,flags);
  (inst.g==='prefix'?item.prefixes:item.suffixes).push(inst);
  return inst;
}
function removeInst(t){
  item.prefixes=item.prefixes.filter(m=>m!==t);
  item.suffixes=item.suffixes.filter(m=>m!==t);
  if(t.crafted) item.hasCrafted=false;
  if(t.desecrated) item.hasDesec=false;
}

/* render mod text with rolled values substituted into the (a-b) ranges */
function modText(inst){
  if(inst.desecrated) return MODS[inst.key].tx;
  var alt=window.__altRange;
  if(inst.disp){
    if(alt){ var md=MODS[inst.key]; var i=0; return inst.disp.replace(/-?[0-9]+(?:[.][0-9]+)?/g, function(){ var st=md&&md.st&&md.st[i++]; return st?('('+st.mn+'-'+st.mx+')'):'#'; }); }
    var j=0; return inst.disp.replace(/-?[0-9]+(?:[.][0-9]+)?/g, function(m){ var v=inst.vals[j++]; return v==null?m:v; });
  }
  var tx=MODS[inst.key].tx;
  if(alt){ return tx.replace(/\n/g,'<br>'); }
  var i2=0;
  tx=tx.replace(/\((\d+)-(\d+)\)/g, function(){ return inst.vals[i2++]; });
  tx=tx.replace(/\n/g,'<br>');
  return tx;
}

