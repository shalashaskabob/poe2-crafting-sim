/* ============================================================
   SETUP
   ============================================================ */
const CLASSES=[...new Set(Object.values(BASES).map(b=>b.c))].sort();
function basesForClass(cls){ return Object.entries(BASES).filter(([n,b])=>b.c===cls).map(([n,b])=>({n,d:b.d})).sort((a,b)=>a.d-b.d); }

function buildClassSelect(){
  const cs=document.getElementById('classSel');
  // friendly order: common slots first
  const order=['Boots','Gloves','Helmet','Body Armour','Shield','Amulet','Ring','Belt','Wand','Sceptre','Staff','Bow','Crossbow','Spear','Quiver','Focus','Jewel'];
  const sorted=[...CLASSES].sort((a,b)=>{ const ia=order.indexOf(a),ib=order.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b); });
  cs.innerHTML=sorted.map(c=>`<option value="${c}">${c}</option>`).join('');
  cs.value='Boots';
  populateBases();
}
function populateBases(){
  const cls=document.getElementById('classSel').value;
  const bs=basesForClass(cls);
  const sel=document.getElementById('baseSel');
  sel.innerHTML=bs.map(b=>`<option value="${b.n}">${b.n} (drop lvl ${b.d})</option>`).join('');
  document.getElementById('baseCount').textContent=`${Object.keys(BASES).length} bases`;
}
document.getElementById('classSel').onchange=()=>{ populateBases(); startFromSelectors(); };
document.getElementById('baseSel').onchange=startFromSelectors;
document.getElementById('ilvlIn').onchange=()=>{ if(item){ item.ilvl=Math.max(1,Math.min(86,parseInt(document.getElementById('ilvlIn').value)||82)); render(); } };
document.getElementById('newBase').onclick=()=>{ SEED=(Math.random()*1e9)|0; startFromSelectors(); };
function startFromSelectors(){ const name=document.getElementById('baseSel').value; const il=parseInt(document.getElementById('ilvlIn').value)||82; if(name)newItem(name,il); }
document.getElementById('undoBtn').onclick=undo;
document.getElementById('resetBtn').onclick=()=>newItem(item.base,item.ilvl);

document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ const t=b.dataset.go;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on')); document.getElementById(t).classList.add('on');
  document.querySelectorAll('.navlinks button').forEach(n=>n.classList.toggle('on',n.dataset.go===t)); window.scrollTo({top:0,behavior:'smooth'}); });

/* recipes */
const RECIPES=[
  {cls:'Boots',pick:b=>b.includes('Advance')||b.includes('Dragon')||b.includes('Rawhide'),il:82,t:'Tier-1 movement boots',d:'35% move speed needs ilvl 82. Watch the speed-mod odds shrink as you fill slots.'},
  {cls:'Body Armour',pick:b=>b.includes('Robe')||b.includes('Vest')||b.includes('Garb'),il:82,t:'Triple-res hybrid chest',d:'Life prefix + resistance suffixes — the bread-and-butter armour craft.'},
  {cls:'Two Hand Mace',pick:b=>true,il:82,t:'Physical two-hander',d:'Essence of Abrasion for flat phys, then %phys and attack-speed slams.'},
  {cls:'Ring',pick:b=>true,il:82,t:'Life + resist ring',d:'Tight pools mean high per-slam odds — a good place to read the numbers.'},
];
function buildRecipes(){ const box=document.getElementById('recipes');
  box.innerHTML=RECIPES.map((r,i)=>`<div class="recipe" data-r="${i}"><h4>${r.t}</h4><p>${r.d}</p></div>`).join('');
  box.querySelectorAll('.recipe').forEach(el=>el.onclick=()=>{ const r=RECIPES[el.dataset.r];
    const cands=basesForClass(r.cls).filter(b=>r.pick(b.n)); const chosen=(cands.length?cands:basesForClass(r.cls)).slice(-1)[0];
    document.getElementById('classSel').value=r.cls; populateBases(); document.getElementById('baseSel').value=chosen.n;
    document.getElementById('ilvlIn').value=r.il; SEED=(Math.random()*1e9)|0; newItem(chosen.n,r.il);
    document.getElementById('forge').scrollIntoView({behavior:'smooth'});
    pushLessons([L(`Loaded recipe: ${r.t} on ${chosen.n}.`,r.d+' Follow the canonical order; the odds panel shows the real probability at each step.','goodL')]); }); }

function buildEmbers(){ const e=document.getElementById('embers'); for(let i=0;i<16;i++){ const s=document.createElement('div'); s.className='ember';
  s.style.left=(Math.random()*100)+'%'; s.style.animationDuration=(4+Math.random()*5)+'s'; s.style.animationDelay=(Math.random()*6)+'s';
  s.style.background=pick(['#c79a4b','#e0623a','#5aa9e6','#e8c64a']); e.appendChild(s); } }

let toastT; function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1900); }

/* ---------- CODEX ---------- */
const CODEX=[
  {id:'odds',t:'I · How the odds work',h:`
    <p>Every modifier carries a <b>spawn weight</b> per item tag. When an orb adds a mod, the game builds the pool of every mod that's <em>eligible right now</em> and rolls one with probability <code>weight ÷ Σ eligible weights</code>.</p>
    <div class="callout"><b>Eligible</b> means: the right side (prefix/suffix), the mod's required level ≤ your item level, no mod from its group already present, and a positive weight on your base's tags. Greater/Perfect floors and omens shrink the pool further — and the odds panel recomputes after every change.</div>
    <h4>Why the panel matters</h4>
    <p>A T1 movement-speed mod and a junk resistance mod might both be eligible, but with very different weights. The odds panel shows the real split, so you can see — before spending — whether your target is a 14% slam or a 2% one, and how an omen or a filled slot moves that number.</p>
    <div class="callout warn"><b>Weights are real, patch is mixed.</b> These weights are datamined from the game (build 4.5.3.1.4) with the known 0.5 deltas hand-patched (skill caps, Int-armour ES recharge). A handful of 0.5-specific retunes may still differ — cross-check PoE2DB before a mirror-tier craft.</div>`},
  {id:'anatomy',t:'II · Item anatomy',h:`
    <p>An item is a <b>base</b> at an <b>item level</b>, with a <b>rarity</b> gating mod count, split into prefixes and suffixes.</p>
    <table class="ref"><tr><th>Rarity</th><th>Mods</th></tr><tr><td style="color:var(--normal)">Normal</td><td>0</td></tr>
    <tr><td style="color:var(--magic)">Magic</td><td>1 prefix + 1 suffix</td></tr><tr><td style="color:var(--rare)">Rare</td><td>3 prefixes + 3 suffixes (the 6-mod cap)</td></tr></table>
    <p><b>Attribute bases</b> gate the pool: Strength→Armour, Dexterity→Evasion, Intelligence→Energy Shield. That's encoded in the base's tags, which is exactly what the weight resolver reads — so a pure-Str chest and a Str/Int chest show different odds.</p>
    <div class="callout"><b>One mod per group.</b> An item holds only one mod per group; a guaranteed-mod currency fails rather than duplicate. Filling a group also removes it from the pool — watch a family vanish from the odds panel once you roll it.</div>`},
  {id:'tiers',t:'III · Currency tiers & floors',h:`
    <p>Transmute, Augment, Regal, Exalt and Chaos come in <b>Lesser / Greater / Perfect</b>. Higher tiers enforce a minimum mod level, cutting the lowest tiers from the pool.</p>
    <table class="ref"><tr><th>Currency</th><th>Greater floor</th><th>Perfect floor</th></tr>
    <tr><td>Transmute / Augment</td><td>mod-lvl 44 <span class="pill">0.5</span></td><td>70</td></tr>
    <tr><td>Exalt / Regal / Chaos</td><td>mod-lvl 35</td><td>50</td></tr></table>
    <p>Hover a Greater or Perfect orb and watch the odds panel: low tiers drop out, and the probability mass concentrates on the higher tiers. The floor never empties a family — if it would, the family's best available tier is kept.</p>`},
  {id:'omens',t:'IV · Omens reshape the odds',h:`
    <p>Omens bend the next matching orb. Arm <b>Sinistral/Dextral</b> and the odds panel switches to that side only — the clearest demonstration of how side-targeting concentrates your chances. Whittling, Greater Exaltation, Crystallisation and the Lich omens all narrow the pool in their own way.</p>
    <div class="callout"><b>An omen never breaks the item's own rules.</b> It only changes the orb it pairs with — it can't exceed the 3-prefix / 3-suffix cap. A craft that would need to break that simply fizzles.</div>`},
  {id:'fracture',t:'V · Fracturing & isolation',h:`
    <p>A Fracturing Orb locks one random mod (≥4 mods). The lock itself is random, but a fractured mod <b>can't be hit by Annul or Chaos</b> — and that's the real power.</p>
    <div class="callout"><b>The isolation move:</b> arm a side-targeting Annul (removes the whole other side from the pool), fracture your keepers on the target side until only the unwanted mod is un-fractured, then Annul — it has exactly one legal target, so removal is deterministic.</div>`},
  {id:'workflow',t:'VI · Master workflow',h:`
    <p>Cheap & reversible first, expensive & irreversible last. Each step constrains the next.</p>
    <ol class="steps">
      <li><b>Base</b> — ilvl 81–82 of the right class.</li>
      <li><b>Essence to Rare</b> — your one guaranteed mod.</li>
      <li><b>Exalt slams</b> — fill toward ~4 mods with side omens; leave slots open.</li>
      <li><b>Desecrate</b> — land a Lich mod if wanted.</li>
      <li><b>Clean up</b> — side-targeted Annul / Whittling Chaos.</li>
      <li><b>Fracture</b> (high-end) — lock a key mod, set up isolation.</li>
      <li><b>Final slams</b> — Perfect Exalt / Perfect Essence for the last best mod.</li>
      <li><b>Quality → Divine → sockets → Corrupt</b> — finishing, in that order.</li>
    </ol>
    <div class="callout warn">Under-fill on purpose so your last, most expensive slam lands at Perfect tier — instead of paying Perfect prices on every slot.</div>`},
  {id:'endgame',t:'VII · Crafting endgame gear',h:`
    <p>This is the practical guide: how to take a white base and finish a gear piece your build can actually use at the top of the Atlas. Everything below is loadable in the bench — pick the base named in each example, set the item level, and the odds panel shows the real probability of each step.</p>

    <h4>Before you spend a single orb</h4>
    <p>Endgame crafting rewards planning far more than luck. Three decisions are made <em>before</em> you touch currency, and getting them wrong wastes everything after:</p>
    <ol class="steps">
      <li><b>Finalise your build first.</b> A T1 crit mod is only T1 <em>for you</em> if your tree scales crit. Decide which 4–6 stats this slot must provide before crafting — changing your mind mid-craft is the most expensive mistake in the game.</li>
      <li><b>Pick the base for its pool, then its item level.</b> The base's attribute gates which mods can roll at all (Str→Armour, Dex→Evasion, Int→Energy Shield; hybrids draw from both). Then buy item level <b>81–82</b> for T1 access — but know the two ilvl thresholds that matter most: <code>ilvl 82</code> for T1 elemental resistance and T1 movement speed, <code>ilvl 81</code> for T1 chaos resistance and top-tier life. Below those, the mod simply cannot appear.</li>
      <li><b>Read the pool on the bench (or PoE2DB).</b> Load the base at your target ilvl and look at the odds panel with no mods yet. That's your raw pool. If your dream mod isn't in it, no amount of currency will conjure it.</li>
    </ol>
    <div class="callout"><b>The high-ilvl-vs-narrow-pool trade.</b> ilvl 82 maximises the ceiling but every low tier is still eligible, diluting each slam. A deliberately lower base (ilvl 75–80) excludes the top tiers <em>and</em> a lot of competing junk, so each roll is likelier to land what you want. Use 82 for a true best-in-slot; drop to 78–80 for a cheaper, more reliable craft. Watch the odds panel — you'll see the target's percentage actually <em>rise</em> on a lower-ilvl base.</div>

    <h4>The core loop, in one sentence</h4>
    <p>Guarantee your one must-have mod with an Essence, slam the cheap supporting mods while leaving slots open, then spend the expensive currency only on the final one or two slots — and corrupt last, if at all.</p>

    <h3 style="margin-top:34px">Worked craft A — Tier-1 movement boots</h3>
    <p class="pill" style="margin-bottom:8px">Load: any dex base (e.g. Rawhide Boots) · ilvl 82</p>
    <p>The classic. Goal: 35% movement speed (T1 prefix, needs ilvl 82), high evasion, and two useful resistances. Movement speed is a <b>prefix</b> in the real data — many guides get this wrong, so verify on the bench.</p>
    <ol class="steps">
      <li><b>Greater Essence of Enhancement-style defence</b> isn't in this build's essence set, so instead <b>Transmute → Augment</b> until you have movement speed on the magic base. Each Augment, the odds panel shows your MS chance (~13–14% on an open prefix at ilvl 82). If you hit a non-MS prefix, Annul it and re-augment; if you hit a suffix, augment again.</li>
      <li>Once MS is on a magic item, <b>Greater Regal</b> with <b>Omen of Dextral Coronation</b> (suffix only) to add a resistance without risking a second prefix.</li>
      <li><b>Greater Exalt + Omen of Dextral Exaltation</b> twice for two more resistance suffixes. Side-targeting keeps the prefix side (your MS + evasion) untouched.</li>
      <li>Fill the last prefix with <b>Perfect Exalt + Sinistral Exaltation</b> for high evasion — Perfect's mod-level-50 floor guarantees a strong tier.</li>
      <li><b>Quality</b> with Armourer's Scraps to 20%, then <b>Divine</b> to push the MS roll toward 35%.</li>
    </ol>
    <div class="callout"><b>Why it works:</b> the only random step is landing MS in step 1, and that's cheap to retry on a magic base. Everything after is side-locked, so you never overwrite your speed.</div>

    <h3 style="margin-top:30px">Worked craft B — Triple-resistance hybrid chest</h3>
    <p class="pill" style="margin-bottom:8px">Load: a Str/Int body (e.g. Pilgrim Vestments) · ilvl 82</p>
    <p>The defensive backbone of most builds: a big life prefix, three maxed resistances, and a defence roll. A Str/Int base can roll both Armour and Energy Shield, widening your options.</p>
    <ol class="steps">
      <li><b>Greater Essence of the Body</b> on a magic base → guarantees maximum Life (prefix) and upgrades to Rare. This is your one crafted modifier — spend it on the mod you can least afford to gamble.</li>
      <li><b>Greater Exalt + Dextral Exaltation</b> three times to fill the suffix side with resistances. The odds panel shows each resistance at roughly equal weight; you're fishing for the three your build needs. Use <b>Chaos + Dextral Erasure</b> to swap a wrong resistance without touching prefixes.</li>
      <li>One prefix slot remains: <b>Perfect Exalt + Sinistral Exaltation</b> for a % defence roll (Armour or ES).</li>
      <li>If a resistance landed at a low tier, <b>Omen of Whittling + Chaos</b> targets the lowest item-level mod specifically — hover-check the highlight before committing.</li>
      <li>Quality → Divine → socket a rune (Body/Mind for life/mana, or a resistance rune to free a suffix).</li>
    </ol>
    <div class="callout danger"><b>One crafted modifier only (0.5 rule).</b> Your Essence of the Body is that one crafted mod. You cannot then use a second Essence or a Runic Alloy on this chest — they all compete for the same slot. Plan your single guaranteed mod carefully.</div>

    <h3 style="margin-top:30px">Worked craft C — Endgame physical two-hander (with isolation)</h3>
    <p class="pill" style="margin-bottom:8px">Load: a Two Hand Mace · ilvl 82</p>
    <p>Weapons are where the isolation trick earns its keep. Goal: flat physical (prefix), % physical (prefix), attack speed (suffix), crit (suffix), and a +to-skills or accuracy filler.</p>
    <ol class="steps">
      <li><b>Greater Essence of Abrasion</b> → guarantees flat physical damage (prefix), upgrades to Rare.</li>
      <li><b>Greater Exalt + Sinistral Exaltation</b> for % increased physical (prefix). Now two strong prefixes.</li>
      <li><b>Greater Exalt + Dextral Exaltation</b> twice for attack speed and crit suffixes.</li>
      <li>You now have 4–5 mods, one of which may be a weak filler. <b>This is the isolation setup:</b> arm <b>Omen of Sinistral Annulment</b> (or Dextral, matching the filler's side), <b>Fracture</b> your good mods on that side until only the filler is un-fractured, then <b>Annul</b> — with one legal target left, the filler is removed deterministically.</li>
      <li><b>Perfect Exalt</b> into the freed slot for the final premium mod. <b>Quality</b> with Whetstones, <b>Divine</b>, then socket Soul Cores or runes.</li>
      <li><b>Corrupt last (optional):</b> a Vaal can add a +1 skill implicit — but it's a 25% chance of nothing and a real chance of a brick. Never Vaal a finished weapon you can't afford to lose.</li>
    </ol>

    <h4 style="margin-top:26px">Budgeting & when to stop</h4>
    <p>Match your stopping point to the item's purpose, not to perfection:</p>
    <table class="ref"><tr><th>Tier of craft</th><th>Acceptable result</th><th>Rough spend</th></tr>
      <tr><td>Leveling / early maps</td><td>3–4 useful mods, any tier</td><td>a handful of Exalts</td></tr>
      <tr><td>Solid endgame</td><td>your 4 key mods at T1–T3</td><td>tens of Exalts</td></tr>
      <tr><td>Best-in-slot</td><td>5–6 mods, mostly T1, fractured + divined</td><td>hundreds of Ex / several Divines</td></tr>
      <tr><td>Mirror-tier</td><td>6× near-perfect T1, sold via Mirror</td><td>thousands of Divines</td></tr></table>
    <div class="callout warn"><b>Don't chase a 2% mod with Divine Orbs.</b> If the odds panel says your target is a low-single-digit percent per slam, price out buying the finished base on trade instead — often a fraction of the expected crafting cost. Crafting is for when you can stack constraints to push the odds high; trading is for when you can't.</div>

    <h4>The five rules that prevent most bricks</h4>
    <p>Most ruined items come from breaking one of these: <b>(1)</b> never Divine until the mod list is final — Divine only rerolls numbers and can shift good rolls down. <b>(2)</b> Never fracture an item that's mostly junk — the lock is random, and you'll lock the junk. <b>(3)</b> Add all sockets before corrupting. <b>(4)</b> Never spend Perfect-tier currency on a low-ilvl base — it can't roll its top tiers there. <b>(5)</b> Vaal is always last, and only when you can afford to lose the item.</p>
    <div class="callout"><b>Practice here first.</b> Every craft above is free to run on the bench as many times as you like. Watch the odds panel after each step — internalising how omens, floors, and filled slots reshape the probabilities is the single most valuable crafting skill, and it costs you nothing here.</div>`},
];
function buildCodex(){ const toc=document.getElementById('toc'),body=document.getElementById('codex');
  toc.innerHTML=CODEX.map(s=>`<a href="#${s.id}">${s.t}</a>`).join('');
  body.innerHTML=CODEX.map(s=>`<h3 id="${s.id}">${s.t}</h3>${s.h}`).join(''); }

/* INIT */
document.getElementById('modCountStat').textContent=Object.keys(MODS).length.toLocaleString();
buildClassSelect(); buildRecipes(); buildEmbers(); buildCodex();
newItem(document.getElementById('baseSel').value, 82);
