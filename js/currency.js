/* ============================================================
   CURRENCY
   ============================================================ */
function L(what,why,kind){ return {what,why,kind:kind||''}; }
const CUR=[];
const FLOORS={ transmute:{g:44,p:70}, aug:{g:44,p:70}, regal:{g:35,p:50}, exalt:{g:35,p:50}, chaos:{g:35,p:50} };

function addTiered(idbase,name,cat,cost,color,desc,can,predict,apply){
  ['','Greater','Perfect'].forEach(t=>{
    const floor = t==='Greater'?FLOORS[idbase].g : t==='Perfect'?FLOORS[idbase].p : 0;
    CUR.push({id:idbase+(t||'L'),base:idbase,name:(t?t+' ':'')+name,cat,tier:t,
      cost:cost*(t==='Perfect'?6:t==='Greater'?2.5:1)|0||cost, color, floor,
      desc:desc+(floor?` · floor mod-lvl ${floor}`:''),
      can, predict:()=>predict(floor), apply:()=>apply(floor,t)});
  });
}

addTiered('transmute','Orb of Transmutation','Rarity',1,'#7a93c8','Normal → Magic, +1 mod',
  ()=>item.rarity==='normal'&&!item.corrupted,
  f=>`Upgrades to Magic and adds one mod${f?` (tier floor mod-lvl ${f})`:''}. See odds →`,
  (f)=>{ item.rarity='magic';
    const gen = (rng()<0.5 && oddsFor('prefix',f).groups.length)?'prefix':'suffix';
    const got=addRandomMod(gen,f)||addRandomMod(gen==='prefix'?'suffix':'prefix',f);
    return [L(`Transmutation → Magic. Added: ${modText(got)}`,
      f?`The ${f} floor cut the lowest tiers, so the roll came from a smaller, higher-tier pool — see the odds panel for the exact set it drew from.`
       :`A plain Transmute can roll any eligible tier by weight. The odds panel shows what was possible.`,'goodL')];});

addTiered('aug','Orb of Augmentation','Rarity',1,'#6ec0a0','Magic, add 2nd mod',
  ()=>item.rarity==='magic'&&modCount()<2&&!item.corrupted,
  f=>{ const g=openP()&&!item.prefixes.length?'prefix':'suffix'; return `Adds the 2nd mod on the open ${g}. See odds →`; },
  (f)=>{ const gen = (!item.prefixes.length&&openP())?'prefix':(!item.suffixes.length&&openS())?'suffix':(openP()?'prefix':'suffix');
    const got=addRandomMod(gen,f);
    return [L(`Augmentation. Added: ${modText(got)}`,
      `A Magic item holds 1 prefix + 1 suffix. The Aug fills the empty side — the odds panel shows that side's weighted pool.`,'goodL')];});

addTiered('regal','Regal Orb','Rarity',2,'#c8a868','Magic → Rare, +3rd mod',
  ()=>item.rarity==='magic'&&!item.corrupted,
  f=>{ const c=activeOmens.has('sinCoron')?'prefix (omen)':activeOmens.has('dexCoron')?'suffix (omen)':'a random open side'; return `Upgrades to Rare, adds a mod on ${c}. See odds →`; },
  (f)=>{ item.rarity='rare'; let gen;
    if(activeOmens.has('sinCoron')&&openP()) gen='prefix';
    else if(activeOmens.has('dexCoron')&&openS()) gen='suffix';
    else gen=(openP()&&openS())?(rng()<0.5?'prefix':'suffix'):(openP()?'prefix':'suffix');
    const used=consumeOmen(['sinCoron','dexCoron']);
    const got=addRandomMod(gen,f);
    return [L(`Regal → Rare. Added: ${modText(got)}`,
      used?`A Coronation omen forced the side. The odds panel shows what could land there.`
      :`A plain Regal adds a random mod on a random side. The odds panel shows the full weighted pool it drew from.`,'goodL')];});

CUR.push({id:'alch',base:'alch',name:'Orb of Alchemy',cat:'Rarity',cost:2,color:'#c9c070',floor:0,
  desc:'Normal → Rare, ~4 random mods',
  can:()=>item.rarity==='normal'&&!item.corrupted,
  predict:()=>`Jumps to Rare with 4 random mods, no control. Odds shown per added mod.`,
  apply:()=>{ item.rarity='rare'; let n=0;
    for(let i=0;i<4;i++){ const gen=(openP()&&openS())?(rng()<0.5?'prefix':'suffix'):(openP()?'prefix':openS()?'suffix':null); if(!gen)break; if(addRandomMod(gen,0))n++; }
    return [L(`Alchemy → Rare with ${n} mods.`,`No side or tier control — prefer Transmute→Aug→Regal (or an Essence) on real gear so you steer each mod with the odds in view.`,'warnL')];}});

addTiered('exalt','Exalted Orb','Modifier',6,'#d8c87a','Rare, add a mod to an open slot',
  ()=>item.rarity==='rare'&&modCount()<6&&!item.corrupted,
  f=>{ const two=activeOmens.has('grtExalt'); const s=activeOmens.has('sinExalt')?'prefix only':activeOmens.has('dexExalt')?'suffix only':'a random open side'; return `Adds ${two?'two mods':'one mod'} on ${s}. See odds →`; },
  (f)=>{ const out=[]; const two=activeOmens.has('grtExalt');
    const fP=activeOmens.has('sinExalt'),fS=activeOmens.has('dexExalt'); const used=[];
    if(fP)used.push('Sinistral'); if(fS)used.push('Dextral'); if(two)used.push('Greater');
    for(let i=0;i<(two?2:1);i++){
      let gen=fP?'prefix':fS?'suffix':(openP()&&openS()?(rng()<0.5?'prefix':'suffix'):(openP()?'prefix':openS()?'suffix':null));
      if(fP&&!openP())gen=null; if(fS&&!openS())gen=null;
      if(!gen){ out.push(L('Exalt fizzled — no legal open slot.',`An omen can't break the 3/3 cap; that side was full.`,'badL')); continue; }
      const got=addRandomMod(gen,f);
      out.push(L(`Exalt added: ${modText(got)}`,
        used.length?`Omen(s) ${used.join(' + ')} steered the side. Side-targeting keeps slams from overfilling — the odds panel shows the pool for that side.`
        :`The finishing orb adds one mod to an open slot. The odds panel shows its weighted pool.`,'goodL'));
    }
    consumeOmen(['sinExalt','dexExalt','grtExalt']);
    return out;});

addTiered('chaos','Chaos Orb','Modifier',4,'#b85cc0','Rare, remove 1 mod + add 1',
  ()=>item.rarity==='rare'&&modCount()>0&&!item.corrupted,
  f=>{ if(activeOmens.has('whittle'))return `Removes the LOWEST item-level mod, adds a new one. See odds →`;
    const e=activeOmens.has('sinErase')?'a prefix':activeOmens.has('dexErase')?'a suffix':'a random mod'; return `Removes ${e}, adds one new mod. See odds →`; },
  (f)=>{ let pool=allMods().filter(m=>!m.fractured);
    if(activeOmens.has('sinErase'))pool=pool.filter(m=>m.g==='prefix');
    if(activeOmens.has('dexErase'))pool=pool.filter(m=>m.g==='suffix');
    let target,note='';
    if(activeOmens.has('whittle')&&pool.length){ target=pool.reduce((a,b)=>b.rl<a.rl?b:a,pool[0]); note=`Whittling targets the lowest item-level mod (not lowest tier).`; }
    else if(pool.length) target=pick(pool);
    if(!target){ consumeOmen(['sinErase','dexErase','whittle']); return [L('Chaos fizzled — no legal target.',`Every candidate was fractured or excluded.`,'badL')]; }
    const gen=target.g; removeInst(target);
    const got=addRandomMod((openP()&&openS())?(rng()<0.5?'prefix':'suffix'):(openP()?'prefix':'suffix'),f);
    consumeOmen(['sinErase','dexErase','whittle']);
    return [L(`Chaos: removed ${modText(target)} → added ${modText(got)}`,
      (note||'PoE2 Chaos swaps ONE mod, not the whole item.')+' Pair with Erasure to pick a side or Whittling to hit the junk mod. Odds panel shows the add pool.','goodL')];});

CUR.push({id:'annul',base:'annul',name:'Orb of Annulment',cat:'Modifier',cost:5,color:'#cfcfcf',floor:0,
  desc:'Remove one random mod',
  can:()=>item.rarity==='rare'&&modCount()>0&&!item.corrupted,
  predict:()=>{ const s=activeOmens.has('sinAnnul')?'a prefix':activeOmens.has('dexAnnul')?'a suffix':'a random non-fractured mod'; return `Removes ${s}. Fractured mods are immune (the isolation trick).`; },
  apply:()=>{ let pool=allMods().filter(m=>!m.fractured);
    if(activeOmens.has('sinAnnul'))pool=pool.filter(m=>m.g==='prefix');
    if(activeOmens.has('dexAnnul'))pool=pool.filter(m=>m.g==='suffix');
    if(!pool.length){ consumeOmen(['sinAnnul','dexAnnul']); return [L('Annul fizzled — all candidates fractured/excluded.',`Exactly the state isolation creates: lock the keepers, exclude a side, and only the unwanted mod is a legal target.`,'warnL')]; }
    const t=pick(pool); removeInst(t); const used=consumeOmen(['sinAnnul','dexAnnul']);
    return [L(`Annulment removed: ${modText(t)}`,
      used?`The omen restricted the Annul to one side. With fractures shrinking the pool to one, removal becomes deterministic.`
      :`A blind Annul is a coin-flip across every non-fractured mod. Pair with a side omen + fractures (Trick I: Isolation).`,'goodL')];}});

CUR.push({id:'divine',base:'divine',name:'Divine Orb',cat:'Modifier',cost:60,color:'#e8d28a',floor:0,
  desc:'Reroll numeric values',
  can:()=>(item.rarity==='rare'||item.rarity==='magic')&&modCount()>0&&!item.corrupted&&!item.sanctified,
  predict:()=>activeOmens.has('sanctify')?`Sanctifies: ×0.78–1.22 on each value, then locks the item.`:`Rerolls every mod's numeric value within its range. Types unchanged.`,
  apply:()=>{ if(activeOmens.has('sanctify')){ consumeOmen(['sanctify']);
      allMods().forEach(m=>{ const md=MODS[m.key]; m.vals=m.vals.map((v,i)=>{ const s=md.st[i]; const f=0.78+rng()*0.44; return Math.max(s.mn,Math.min(s.mx,Math.round(v*f))); }); });
      item.sanctified=true; return [L(`Sanctified — values ×0.78–1.22, item locked.`,`Sanctification pushes an already-good Rare's rolls up, then marks it Sanctified (a finishing step).`,'goodL')]; }
    allMods().forEach(m=>{ const md=MODS[m.key]; m.vals=md.st.map(s=>s.mn+Math.floor(rng()*(s.mx-s.mn+1))); });
    return [L(`Divine — rerolled all numeric values.`,`Divine only moves numbers within each mod's range; it never changes which mods you have. Final polish only.`,'goodL')];}});

CUR.push({id:'fracture',base:'fracture',name:'Fracturing Orb',cat:'Modifier',cost:700,color:'#9a7fd0',floor:0,
  desc:'Lock 1 random mod (≥4 mods)',
  can:()=>item.rarity==='rare'&&modCount()>=4&&!item.corrupted&&!allMods().some(m=>m.fractured),
  predict:()=>`Locks ONE random mod permanently — on a ${modCount()}-mod item that's ${Math.round(100/Math.max(modCount(),1))}% per mod.`,
  apply:()=>{ const ms=allMods(); const t=pick(ms); t.fractured=true;
    return [L(`Fractured: ${modText(t)} is now permanent.`,
      `The lock is random (${Math.round(100/ms.length)}% it landed where you hoped). A fractured mod can't be hit by Annul or Chaos — that shrinks their legal pool, enabling deterministic deletion.`,'goodL')];}});

CUR.push({id:'vaal',base:'vaal',name:'Vaal Orb',cat:'Corruption',cost:3,color:'#d04b3a',floor:0,
  desc:'Corrupt — random, irreversible',
  can:()=>!item.corrupted&&item.rarity!=='normal',
  predict:()=>`Random outcome, then CORRUPTED & locked forever. Raw gambling in 0.5 — no anti-brick omen.`,
  apply:()=>{ item.corrupted=true; const r=rng();
    if(r<0.25) return [L(`Vaal: nothing changed (cosmetic). Now Corrupted.`,`~1 in 4 Vaals do nothing but lock the item — there's no Omen of Corruption in 0.5 to remove that result.`,'warnL')];
    if(r<0.5){ const cls=curBase().c; const imp=(cls==='Wand'||cls==='Staff'||cls==='Sceptre')?'+1 to Level of all Spell Skills':'+1 to Level of all Skills';
      item.vaalImplicit=imp; return [L(`Vaal: corrupted implicit — ${imp}.`,`The dream outcome — corrupted implicits can't be crafted any other way.`,'goodL')]; }
    if(r<0.7){ if(item.sockets<(SOCKETS[curBase().c]||0)+1){ item.sockets++; return [L(`Vaal: added a socket (can exceed max).`,`Corruption can push sockets past the natural maximum.`,'goodL')]; } return [L(`Vaal: nothing changed. Corrupted.`,`Socket outcome had nowhere to go.`,'warnL')]; }
    item.prefixes=[];item.suffixes=[];item.hasCrafted=false;item.hasDesec=false;
    const n=3+Math.floor(rng()*3); for(let i=0;i<n;i++){ const gen=(openP()&&openS())?(rng()<0.5?'prefix':'suffix'):(openP()?'prefix':openS()?'suffix':null); if(gen)addRandomMod(gen,0); }
    return [L(`Vaal: REROLLED into a new random Rare. (Brick.)`,`The brick outcome — every finished mod replaced. This is why you Vaal LAST, never on something you can't lose.`,'badL')];}});

/* ---------- ESSENCES (built from real essence-like mods) ----------
   We expose a curated set mapped to real mod tier-groups so the guaranteed
   mod uses real weights/values. */
const ESSENCE_DEFS=[
  {id:'life',name:'Essence of the Body',ty:'IncreasedLife'},
  {id:'mana',name:'Essence of the Mind',ty:'IncreasedMana'},
  {id:'fireres',name:'Essence of Insulation',ty:'FireResistance'},
  {id:'coldres',name:'Essence of Thawing',ty:'ColdResistance'},
  {id:'lightres',name:'Essence of Grounding',ty:'LightningResistance'},
  {id:'chaosres',name:'Essence of Ruin',ty:'ChaosResistance'},
  {id:'phys',name:'Essence of Abrasion',ty:'PhysicalDamage'},
  {id:'attackspd',name:'Essence of Haste',ty:'LocalIncreasedAttackSpeed'},
  {id:'spelldmg',name:'Essence of Sorcery',ty:'WeaponSpellDamage'},
];
function essenceSide(ty){ const k=TIERS[ty]&&TIERS[ty][0]; return k?MODS[k].g:'prefix'; }
function essenceUsableHere(def){ // can this essence's group roll on this base at all?
  const ty=def.ty; if(!TIERS[ty]) return false;
  const tags=baseTagSet();
  return TIERS[ty].some(k=>MODS[k].rl<=item.ilvl && weightOnBase(k,tags)>0 && !MODS[k].es===false?true:weightOnBase(k,tags)>0);
}
function essenceGroupEligible(def){
  const tags=baseTagSet();
  return TIERS[def.ty] && TIERS[def.ty].some(k=>weightOnBase(k,tags)>0);
}
function applyEssence(def,perfect){
  const ty=def.ty;
  if(!essenceGroupEligible(def)) return [L(`${def.name} can't be used on this base.`,`That base type can't roll this modifier at all — its tags exclude the group.`,'badL')];
  if(item.hasCrafted) return [L(`Can't apply ${def.name} — item already has a crafted modifier.`,`0.5 rule: ONE crafted modifier per item. Your Essence, any Perfect Essence, and any Runic Alloy share the same single slot.`,'badL')];
  const side=essenceSide(ty);
  if(presentGroups().has(MODS[TIERS[ty][0]].gr[0])) return [L(`${def.name} fizzled — item already has a mod from that group.`,`One modifier per group; the guaranteed mod collides with one present.`,'badL')];
  // floor: greater ~ mod-lvl 35-ish (use 35), perfect ~ 50
  const floor=perfect?50:35;
  if(!perfect){
    if(item.rarity!=='magic') return [L(`Greater ${def.name} needs a Magic item.`,`Greater essences upgrade Magic → Rare with the guaranteed mod. Use Perfect on a Rare.`,'warnL')];
    if((side==='prefix'&&!openP())||(side==='suffix'&&!openS())) return [L(`${def.name} fizzled — that side is full.`,`Its guaranteed mod is a ${side}; that side has no open slot.`,'badL')];
    item.rarity='rare'; const key=rollGroupTier(ty,floor); const inst=makeInst(key,{crafted:true});
    (side==='prefix'?item.prefixes:item.suffixes).push(inst); item.hasCrafted=true;
    return [L(`Greater ${def.name} → Rare. Guaranteed: ${modText(inst)}`,`Essences force a chosen mod instead of gambling. Transmute→Aug→Greater Essence makes two-thirds of the item deterministic before you spend an Exalt.`,'goodL')];
  } else {
    if(item.rarity!=='rare') return [L(`Perfect ${def.name} needs a Rare item.`,`Perfect Essences remove a random mod and add the guaranteed one — they act on Rares.`,'warnL')];
    let pool=allMods().filter(m=>!m.fractured);
    if(activeOmens.has('sinCryst'))pool=pool.filter(m=>m.g==='prefix');
    if(activeOmens.has('dexCryst'))pool=pool.filter(m=>m.g==='suffix');
    if(pool.length){ removeInst(pick(pool)); }
    if((side==='prefix'&&!openP())||(side==='suffix'&&!openS())) return [L(`Perfect ${def.name} fizzled — no open ${side} for the guaranteed mod.`,`Use a matching Crystallisation omen so the removal frees a slot on the essence's side.`,'badL')];
    const key=rollGroupTier(ty,floor); const inst=makeInst(key,{crafted:true});
    (side==='prefix'?item.prefixes:item.suffixes).push(inst); item.hasCrafted=true;
    consumeOmen(['sinCryst','dexCryst']);
    return [L(`Perfect ${def.name}: removed a mod, guaranteed ${modText(inst)}`,`Targeted replace. Crystallisation omens control which SIDE the removal comes from — fracture the rest so only filler is removable.`,'goodL')];
  }
}

/* ---------- DESECRATION (Lich mods) ---------- */
const LICH=[
  {tx:'Attacks Penetrate 8% Chaos Resistance',g:'suffix',tg:['chaos'],lich:'Ulaman'},
  {tx:'+25 to Spirit',g:'prefix',tg:['caster'],lich:'Amanamu'},
  {tx:'Recover 4% of maximum Life on Kill',g:'prefix',tg:['life'],lich:'Kurgal'},
  {tx:'Gain 12% of Damage as Extra Fire Damage',g:'prefix',tg:['fire'],lich:'Ulaman'},
  {tx:'+8% Chance to Block',g:'suffix',tg:['defence'],lich:'Kurgal'},
  {tx:'+18% increased Area of Effect',g:'suffix',tg:['area'],lich:'Amanamu'},
];
function applyBone(){
  if(item.rarity!=='rare') return [L('Desecration needs a Rare with an open slot.',`Bones add a hidden Desecrated mod to a Rare.`,'warnL')];
  if(item.hasDesec) return [L('Item already has a Desecrated modifier.',`0.5: one desecrated mod per item. Remove it (Omen of Light + Annul) first.`,'badL')];
  let gen=activeOmens.has('sinNecro')?'prefix':activeOmens.has('dexNecro')?'suffix':(openP()&&openS()?(rng()<0.5?'prefix':'suffix'):(openP()?'prefix':'suffix'));
  if((gen==='prefix'&&!openP())||(gen==='suffix'&&!openS())){ if(modCount()>=6){ const r=pick(allMods().filter(m=>!m.fractured)); if(r)removeInst(r); } }
  if((gen==='prefix'&&!openP())||(gen==='suffix'&&!openS())) return [L('No open slot on that side.',`Free a slot on the omen's side first.`,'warnL')];
  let pool=LICH.filter(m=>m.g===gen);
  if(activeOmens.has('blackblooded'))pool=pool.filter(m=>m.lich==='Kurgal');
  if(activeOmens.has('liege'))pool=pool.filter(m=>m.lich==='Amanamu');
  if(activeOmens.has('sovereign'))pool=pool.filter(m=>m.lich==='Ulaman');
  if(!pool.length)pool=LICH.filter(m=>m.g===gen);
  consumeOmen(['sinNecro','dexNecro','blackblooded','liege','sovereign']);
  const copy=[...pool],offer=[]; for(let i=0;i<3&&copy.length;i++)offer.push(copy.splice(Math.floor(rng()*copy.length),1)[0]);
  pendingReveal={gen,offer,canReroll:activeOmens.has('echoes'),used:false};
  consumeOmen(['echoes']);
  return [L(`Bone applied — hidden Desecrated mod (${gen}). Reveal at the Well of Souls below.`,
    `Desecration is the only source of Lich mods — you pick 1 of 3. Necromancy omens set the side; Lich omens force which lich's pool you draw from.`,'goodL')];
}
function revealDesec(i){
  if(!pendingReveal)return; const m=pendingReveal.offer[i];
  const inst={key:null,ty:'desec_'+m.lich,g:m.g,gr:['desec'],tg:m.tg,rl:0,vals:[],rank:0,crafted:false,desecrated:true,fractured:false,lich:m.lich,dtext:m.tx};
  (m.g==='prefix'?item.prefixes:item.suffixes).push(inst); item.hasDesec=true; pendingReveal=null;
  pushLessons([L(`Revealed (${m.lich}): ${m.tx}`,`You chose 1 of 3. If none were useful, Omen of Light + an Annul removes ONLY the desecrated mod so you can re-bone — the chase loop.`,'goodL')]); render();
}
function rerollReveal(){ if(!pendingReveal||!pendingReveal.canReroll||pendingReveal.used)return;
  let pool=LICH.filter(m=>m.g===pendingReveal.gen); const copy=[...pool],offer=[];
  for(let i=0;i<3&&copy.length;i++)offer.push(copy.splice(Math.floor(rng()*copy.length),1)[0]);
  pendingReveal.offer=offer; pendingReveal.used=true;
  pushLessons([L(`Abyssal Echoes: rerolled the three options once.`,`Echoes gives one second look — three fresh options, not a six-wide menu.`,'goodL')]); render(); }

/* quality / sockets */
function applyQuality(){ if(item.corrupted)return toast('Corrupted — locked'); if(item.rarity==='normal')return toast('Make it Magic/Rare first');
  pushHist(); item.quality=Math.min(20,item.quality+5); spent+=1;
  pushLessons([L(`Quality +5% (now ${item.quality}%).`,`Quality multiplies existing mod magnitudes — apply before Divining. Cheap, no downside.`,'goodL')]); render(); }
function addSocket(){ if(item.corrupted)return toast('Corrupted — locked'); const max=SOCKETS[curBase().c]||0;
  if(max===0)return toast('This item type has no sockets'); if(item.sockets>=max)return toast('At max sockets');
  pushHist(); item.sockets++; spent+=2;
  pushLessons([L(`Artificer's Orb — socket added (${item.sockets}/${max}).`,`Add all sockets before corrupting; runes go in last, after all affixes are final.`,'goodL')]); render(); }

function consumeOmen(ids){ let u=false; ids.forEach(id=>{ if(activeOmens.has(id)){activeOmens.delete(id);u=true;} }); return u; }
function pushLessons(arr){ const box=document.getElementById('lessons');
  arr.forEach(l=>{ const d=document.createElement('div'); d.className='lesson '+(l.kind||'');
    d.innerHTML=`<div class="what">${l.what}</div>${l.why?`<div class="why">${l.why}</div>`:''}`; box.appendChild(d); });
  box.scrollTop=box.scrollHeight; }

function runCurrency(c){ if(item.corrupted){ toast('Item is corrupted'); return; } if(!c.can()){ toast("Can't use that orb now"); return; }
  pushHist(); const lessons=c.apply(); spent+=c.cost||0; pushLessons(lessons); render(); }

