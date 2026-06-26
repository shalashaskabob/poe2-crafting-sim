/* ============================================================
   CRAFT BENCH 2.0 — inventory, PoE2 item import, coach, planner
   Injected as a classic <script> after the main app script, so it
   shares the global lexical scope (BASES, MODS, TIERS, item, render…).
   ============================================================ */
(function(){
  "use strict";
  if(window.__CB_LOADED){ console.warn('CB already loaded'); }
  window.__CB_LOADED=true;

  /* ---------- mod-text matching ---------- */
  const baseNorm=s=>(''+s).toLowerCase()
    .replace(/\(\d+(?:\.\d+)?-\d+(?:\.\d+)?\)/g,'#')
    .replace(/-?\d+(?:\.\d+)?/g,'#')
    .replace(/\+/g,'').replace(/\battacks\b/g,'attack').replace(/\bminions\b/g,'minion').replace(/\s+/g,' ').trim();
  const alias=t=>t
    .replace(/to (fire|cold|lightning) resistance/g,'to resistances')
    .replace(/to all elemental resistances/g,'to all elementaldamage resistances');
  const MOD_IDX={}, LOOSE_IDX={};
  const looseKey=t=>t.split(' ').map(w=>w.replace(/s$/,'')).join(' '); // ignore trailing-s (plural/singular) diffs
  for(const k in MODS){ if(MODS[k].es) continue; const t=baseNorm(MODS[k].tx);
    (MOD_IDX[t]=MOD_IDX[t]||[]).push(k); const lt=looseKey(t); (LOOSE_IDX[lt]=LOOSE_IDX[lt]||[]).push(k); }

  // PoE2 "advanced" copy shows values as "+23(20-30)%" — drop the (min-max) part, keep the actual value.
  const stripRanges = s => (''+s).replace(/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g,'').replace(/\s{2,}/g,' ').trim();
  function matchModLine(rawLine){
    const line=stripRanges(rawLine);
    const t=alias(baseNorm(line)); const cand=MOD_IDX[t]||LOOSE_IDX[looseKey(t)]; if(!cand) return null;
    const nums=(line.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);
    let best=cand[0], bs=-1e9;
    for(const k of cand){ const st=MODS[k].st; let sc=0;
      for(let i=0;i<st.length;i++){ const v=nums[i]; if(v==null) continue;
        sc += (v>=st[i].mn && v<=st[i].mx) ? 3 : -Math.abs(v-(st[i].mn+st[i].mx)/2)/Math.max(1,Math.abs(st[i].mx)||1); }
      if(sc>bs){ bs=sc; best=k; } }
    const m=MODS[best];
    const vals=m.st.map((s,i)=> nums[i]!=null ? nums[i] : Math.round((s.mn+s.mx)/2));
    return { key:best, ty:m.ty, g:m.g, gr:m.gr, tg:m.tg, rl:m.rl, vals,
      rank:(TIERS[m.ty]?TIERS[m.ty].indexOf(best)+1:1),
      crafted:false, desecrated:false, fractured:false, lich:null, disp:(''+line).trim() };
  }

  /* ---------- base matching ---------- */
  const BASE_KEYS=Object.keys(BASES);
  const baseLower={}; BASE_KEYS.forEach(n=>{ baseLower[n.toLowerCase()]=n; });
  function matchBase(name, itemClass){
    if(!name && !itemClass) return null;
    if(name){
      if(BASES[name]) return name;
      const ln=name.toLowerCase().trim();
      if(baseLower[ln]) return baseLower[ln];
      // longest base key contained in the name (handles magic "Prefix Base of Suffix")
      let best=null; const pad=' '+ln+' ';
      for(const n of BASE_KEYS){ const k=' '+n.toLowerCase()+' '; if(pad.includes(k)){ if(!best||n.length>best.length) best=n; } }
      if(best) return best;
    }
    if(itemClass){ const c=BASE_KEYS.find(n=>BASES[n].c===itemClass); if(c) return c; }
    return null;
  }

  /* ---------- PoE2 item-text parser ---------- */
  function parseItem(text){
    const raw=(''+text).replace(/\r/g,'').split('\n').map(s=>s.trim());
    if(!raw.some(l=>/^Item Class:/i.test(l)) && !raw.some(l=>/^Rarity:/i.test(l)))
      return { error:'That doesn’t look like a copied PoE2 item. In-game, hover the item and press Ctrl+C, then paste here.' };
    const firstM=re=>{ for(const l of raw){ const m=l.match(re); if(m) return m; } return null; };
    const cls=((firstM(/^Item Class:\s*(.+)$/i)||[])[1]||'').trim();
    const rar=(((firstM(/^Rarity:\s*(.+)$/i)||[])[1])||'normal').trim().toLowerCase();
    const ilvl=+(((firstM(/^Item Level:\s*(\d+)/i)||[])[1])||82);
    const corrupted=raw.some(l=>/^Corrupted$/i.test(l));
    const rarityIdx=raw.findIndex(l=>/^Rarity:/i.test(l));
    const nameLines=[]; for(let i=rarityIdx+1;i<raw.length;i++){ if(/^-{3,}$/.test(raw[i])) break; if(raw[i]) nameLines.push(raw[i]); }
    let baseName;
    if(rar==='rare'||rar==='unique') baseName=nameLines[1]||nameLines[0];
    else baseName=nameLines[0];
    const base=matchBase(baseName, cls);
    const SKIP=/^(Item Class|Rarity|Requirements|Requires|Level|Str|Dex|Int|Quality|Armour|Evasion|Energy Shield|Block chance|Spirit|Sockets|Note|Corrupted|Unidentified|Stack Size|Radius|Limited to|Item Level|Allocated|Grants Skill|\{)/i;
    // split into '----'-separated blocks; explicit affixes are the LAST mod-bearing block
    const blocks=[]; let cur=[];
    for(const l of raw){ if(/^-{3,}$/.test(l)){ if(cur.length) blocks.push(cur); cur=[]; } else if(l) cur.push(l); }
    if(cur.length) blocks.push(cur);
    const ilBlock=blocks.findIndex(b=>b.some(l=>/^Item Level:/i.test(l)));
    const tagRe=/\s*\((implicit|fractured|crafted|enchant|rune|desecrated|scourge)\)\s*$/i;
    const blockMods=b=>b.reduce((a,l)=>a+((!SKIP.test(l)&&matchModLine(l.replace(tagRe,'')))?1:0),0);
    let exBlock=null;
    for(let i=blocks.length-1;i>ilBlock;i--){ if(blockMods(blocks[i])>0){ exBlock=blocks[i]; break; } }
    if(!exBlock){ for(let i=blocks.length-1;i>=0;i--){ if(blockMods(blocks[i])>0){ exBlock=blocks[i]; break; } } }
    // implicit lines: mod-bearing blocks between item-level and the explicit block (their ACTUAL rolled text)
    const baseImpl=(base&&BASES[base].i)||[];
    const implTpl=new Set(baseImpl.map(t=>alias(baseNorm(t))));
    const impLines=[];
    for(let i=ilBlock+1;i<blocks.length;i++){ const b=blocks[i]; if(b===exBlock) break;
      if(blockMods(b)>0) b.forEach(l=>{ if(!SKIP.test(l)){ const ln=l.replace(tagRe,''); if(matchModLine(ln)) impLines.push(stripRanges(ln)); } }); }
    // single-block case: the only mod block IS the base implicit (item has no explicit affixes)
    let explicitSource=exBlock||[];
    if(exBlock && baseImpl.length && impLines.length===0){
      const ml=exBlock.filter(l=>!SKIP.test(l)).map(l=>l.replace(tagRe,'')).filter(l=>matchModLine(l));
      if(ml.length && ml.every(l=>implTpl.has(alias(baseNorm(stripRanges(l)))))){ ml.forEach(l=>impLines.push(stripRanges(l))); explicitSource=[]; }
    }
    const prefixes=[], suffixes=[], unmapped=[];
    explicitSource.forEach(l=>{ if(SKIP.test(l)) return;
      const tag=tagRe.exec(l); const line=l.replace(tagRe,'');
      if(tag && /implicit|enchant|rune/i.test(tag[1])) return;
      const m=matchModLine(line);
      if(m){ if(tag&&/fractured/i.test(tag[1])) m.fractured=true; if(tag&&/crafted/i.test(tag[1])) m.crafted=true;
        (m.g==='prefix'?prefixes:suffixes).push(m); }
      else if(/\d/.test(line) && line.length<90) unmapped.push(line);
    });
    const cap = base && BASES[base].c==='Jewel' ? 2 : 3;
    const rarity = rar==='magic'?'magic':(rar==='rare'||rar==='unique')?'rare':'normal';
    const it={ base: base||baseName||'(unknown base)', ilvl:Math.max(1,Math.min(86,ilvl)), rarity,
      quality:0, sockets:0, corrupted, sanctified:false, vaalImplicit:null,
      prefixes:prefixes.slice(0,cap), suffixes:suffixes.slice(0,cap),
      hasCrafted:false, hasDesec:false, rname:(rar==='rare'?nameLines[0]:null), impLines:impLines.length?impLines:undefined };
    return { item:it, base, baseName, cls, rarity, unmapped, ok:!!base,
      droppedAffix:(prefixes.length-it.prefixes.length)+(suffixes.length-it.suffixes.length) };
  }

  /* ---------- inventory state (localStorage) ---------- */
  const LS='poe2_inventory_v1';
  let INV=[];
  try{ INV=JSON.parse(localStorage.getItem(LS)||'[]'); }catch(e){ INV=[]; }
  let uid=Date.now();
  const saveInv=()=>{ try{ localStorage.setItem(LS, JSON.stringify(INV)); }catch(e){} };
  function itemLabel(it){
    const b=BASES[it.base]?it.base:it.base;
    if(it.rarity==='rare') return it.rname||('Rare '+b);
    if(it.rarity==='magic') return 'Magic '+b;
    return b;
  }
  function addToInv(it,label){ const e={id:++uid, label:label||itemLabel(it), item:it}; INV.unshift(e); saveInv(); return e; }

  /* ---------- load an item onto the bench ---------- */
  let activeId=null;
  function loadItem(it, id){
    if(!BASES[it.base]){ toast('Base "'+it.base+'" isn’t in the dataset — load skipped'); return; }
    // sync selectors WITHOUT firing the app's onchange (that would rebuild a white item)
    const cs=document.getElementById('classSel'); if(cs) cs.value=BASES[it.base].c;
    try{ populateBases(); }catch(e){}
    const bs=document.getElementById('baseSel'); if(bs) bs.value=it.base;
    const il=document.getElementById('ilvlIn'); if(il) il.value=it.ilvl;
    // set the item LAST so nothing overwrites it; deep clone to protect the stored copy
    item=JSON.parse(JSON.stringify(it));
    history=[]; spent=0; pendingReveal=null; activeOmens.clear();
    activeId=id||null;
    render();
    document.getElementById('forge').scrollIntoView({behavior:'smooth',block:'start'});
  }

  /* ---------- UI injection ---------- */
  function el(tag,cls,html){ const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }

  function injectCSS(){
    if(document.getElementById('cbStyle')) return;
    const s=el('style'); s.id='cbStyle';
    s.textContent=`
    .cb-native-only{display:none}
    body.cb-native .cb-native-only{display:inline}
    body.cb-native .cb-web-only{display:none}
    .cbrow{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
    @media(max-width:900px){.cbrow{grid-template-columns:1fr}}
    .card.coach .hd,.card.planner .hd{color:var(--brass)}
    .cbHint{font-family:var(--ui);font-size:11.5px;color:var(--ink-faint);line-height:1.5;padding:1px 0 7px}
    .cbEmpty{font-family:var(--ui);font-size:12px;color:var(--ink-faint);border:1px dashed var(--rule);border-radius:4px;padding:18px;text-align:center}
    /* inventory items */
    .cbItems{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:8px}
    .cbItem{position:relative;text-align:left;cursor:pointer;border:1px solid var(--rule);border-radius:4px;
      background:linear-gradient(180deg,var(--panel2),var(--panel));padding:9px 11px;transition:border-color .12s,transform .12s,box-shadow .12s;font-family:var(--body);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.7)}
    .cbItem::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;border-radius:4px 0 0 4px;background:var(--rule-bright)}
    .cbItem.rarity-magic::before{background:var(--magic)} .cbItem.rarity-rare::before{background:var(--rare)} .cbItem.rarity-unique::before{background:var(--unique)}
    .cbItem:hover{border-color:var(--brass-dim);transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.55)}
    .cbItem.active{border-color:var(--brass);box-shadow:0 0 0 1px var(--brass-dim),0 1px 3px rgba(0,0,0,.7)}
    .cbItemName{font-family:var(--display);font-size:13.5px;line-height:1.15;margin-bottom:1px;padding-right:14px}
    .cbItem.rarity-normal .cbItemName{color:var(--normal)} .cbItem.rarity-magic .cbItemName{color:var(--magic)}
    .cbItem.rarity-rare .cbItemName{color:var(--rare)} .cbItem.rarity-unique .cbItemName{color:var(--unique)}
    .cbItemBase{font-family:var(--ui);font-size:10px;color:var(--ink-faint);letter-spacing:.04em}
    .cbItemMeta{font-family:var(--mono);font-size:9.5px;color:var(--ink-dim);margin-top:5px}
    .cbItemMeta b{color:var(--brass)}
    .cbDel{position:absolute;top:4px;right:5px;color:var(--ink-faint);font-size:14px;line-height:1;opacity:.45;border-radius:3px;padding:0 3px;transition:opacity .12s,color .12s,background .12s}
    .cbItem:hover .cbDel{opacity:.7}
    .cbDel:hover{opacity:1;color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,transparent)}
    /* import overlay */
    .cbOverlay{position:fixed;inset:0;z-index:300;background:rgba(6,5,4,.74);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;padding:20px}
    .cbOverlay.on{display:flex}
    .cbModal{width:min(560px,94vw);background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--rule-bright);border-radius:6px;box-shadow:var(--shadow);padding:18px 20px 16px}
    .cbModalHd{font-family:var(--display);font-size:19px;color:var(--brass);margin-bottom:3px}
    .cbModalP{font-family:var(--ui);font-size:12px;color:var(--ink-dim);margin:0 0 11px;line-height:1.5}
    #cbPaste{width:100%;height:224px;resize:vertical;background:var(--bg);border:1px solid var(--rule-bright);border-radius:4px;
      color:var(--ink);font-family:var(--mono);font-size:12px;line-height:1.45;padding:11px;transition:border-color .12s,box-shadow .12s}
    #cbPaste:focus{outline:none;border-color:var(--brass-dim);box-shadow:0 0 0 1px var(--brass-dim)}
    #cbPaste::-webkit-scrollbar{width:8px}#cbPaste::-webkit-scrollbar-thumb{background:var(--rule-bright);border-radius:4px}
    .cbMsg{font-family:var(--ui);font-size:12px;margin-top:10px;min-height:16px;line-height:1.5}
    .cbMsg.good{color:var(--good)} .cbMsg.bad{color:var(--bad)}
    .cbModalBtns{display:flex;justify-content:flex-end;gap:9px;margin-top:13px}
    /* coach */
    .cbTip{border-left:3px solid var(--rule-bright);padding:7px 11px;margin:0 0 7px;background:rgba(255,255,255,.015);border-radius:0 3px 3px 0}
    .cbTip:last-child{margin-bottom:0}
    .cbTip.good{border-color:var(--good)} .cbTip.bad{border-color:var(--bad)}
    .cbTipT{font-family:var(--ui);font-size:12.5px;color:var(--ink);font-weight:500;line-height:1.35}
    .cbTipW{font-family:var(--ui);font-size:11px;color:var(--ink-dim);margin-top:3px;line-height:1.5}
    .cbPool{margin-top:7px;border-top:1px dashed var(--rule);padding-top:8px}
    .cbPoolHd{font-family:var(--ui);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:4px}
    .cbPoolRow{display:flex;gap:9px;font-family:var(--ui);font-size:11.5px;color:var(--ink-dim);padding:1.5px 0}
    .cbPct{font-family:var(--mono);font-size:11px;color:var(--brass);flex:none;width:46px;text-align:right}
    /* planner */
    .cbTargets{display:flex;flex-direction:column;gap:2px;max-height:228px;overflow-y:auto;margin:6px -3px;padding:0 3px}
    .cbTargets::-webkit-scrollbar{width:8px}.cbTargets::-webkit-scrollbar-thumb{background:var(--rule-bright);border-radius:4px}
    .cbTarget{display:flex;align-items:center;gap:8px;padding:3.5px 7px;border-radius:3px;cursor:pointer;font-family:var(--ui);font-size:11.5px;color:var(--ink-dim);transition:background .12s,color .12s}
    .cbTarget:hover{background:rgba(255,255,255,.025)} .cbTarget.on{background:color-mix(in srgb,var(--brass) 10%,transparent);color:var(--ink)}
    .cbTarget input{accent-color:var(--brass);flex:none}
    .cbTSide{font-family:var(--mono);font-size:9px;width:15px;height:15px;border-radius:3px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--brass) 16%,var(--bg));color:var(--brass);flex:none}
    .cbTName{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cbTPct{font-family:var(--mono);font-size:10.5px;color:var(--ink-faint)}
    .cbPlanHd{font-family:var(--ui);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-faint);margin:11px 0 6px;border-top:1px dashed var(--rule);padding-top:9px}
    .cbPlanRow{display:flex;gap:9px;align-items:center;font-family:var(--ui);font-size:11.5px;color:var(--ink-dim);padding:1.5px 0}
    .cbPlanNm em{color:var(--ink-faint);font-style:normal;font-size:10.5px}
    .cbGuar{margin-left:auto;font-family:var(--ui);font-size:9px;letter-spacing:.04em;color:var(--good);border:1px solid color-mix(in srgb,var(--good) 40%,var(--rule));border-radius:2px;padding:1px 5px}
    .cbSteps{margin-top:10px;display:flex;flex-direction:column;gap:6px}
    .cbStep{display:flex;gap:9px;font-family:var(--ui);font-size:11.5px;color:var(--ink-dim);line-height:1.5}
    .cbStep span{flex:none;width:18px;height:18px;border-radius:50%;border:1px solid var(--brass-dim);color:var(--brass);font-family:var(--mono);font-size:10.5px;display:flex;align-items:center;justify-content:center}
    .cbStep b{color:var(--ink)}`;
    document.head.appendChild(s);
  }

  function buildUI(){
    injectCSS();
    // ---- Inventory card, above the forge ----
    const forgeSec=document.getElementById('forge');
    const invSec=el('section','block');
    invSec.innerHTML=`<div class="wrap">
      <div class="eyebrow">Your stash · import real items</div>
      <h2 class="title">Inventory</h2>
      <p class="deck"><b class="cb-native-only">Desktop app:</b> hover an item in PoE2 and press <b>Ctrl+P</b> — it copies and loads automatically, no Ctrl+C needed. <span class="cb-web-only">In a browser, copy the item (<b>Ctrl+C</b>) first, then use the button to paste.</span> Click any stashed item to bench it; the coach and odds update for that exact item.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn primary" id="cbImport">+ Import item <span style="opacity:.65;font-size:11px">Ctrl+P</span></button>
        <button class="btn" id="cbNewWhite">New white base</button>
        <button class="btn" id="cbClearInv">Clear stash</button>
      </div>
      <div id="cbInvGrid"></div>
    </div>`;
    forgeSec.parentNode.insertBefore(invSec, forgeSec);

    // ---- Coach + Planner row, after the forge ----
    const cpSec=el('section','block');
    cpSec.innerHTML=`<div class="wrap"><div class="cbrow">
      <div class="card coach"><div class="hd">Crafting coach <span class="pill" id="cbCoachState">—</span></div>
        <div class="bd" id="cbCoach"></div></div>
      <div class="card planner"><div class="hd">Goal planner <span class="pill">pick targets</span></div>
        <div class="bd" id="cbPlanner"></div></div>
    </div></div>`;
    forgeSec.parentNode.insertBefore(cpSec, forgeSec.nextSibling);

    // ---- import overlay ----
    const ov=el('div','cbOverlay'); ov.id='cbOverlay';
    ov.innerHTML=`<div class="cbModal">
      <div class="cbModalHd">Import a PoE2 item</div>
      <p class="cbModalP">In the desktop app, hover an item in PoE2 and press <b>Ctrl+P</b> to grab it automatically. Otherwise copy it (<b>Ctrl+C</b>) and paste the text below.</p>
      <textarea id="cbPaste" spellcheck="false" placeholder="Item Class: Gloves
Rarity: Rare
Gale Grip
Furtive Wraps
--------
Item Level: 81
--------
+59 to maximum Life
+28% to Cold Resistance
..."></textarea>
      <div id="cbParseMsg" class="cbMsg"></div>
      <div class="cbModalBtns">
        <button class="btn" id="cbCancel">Cancel</button>
        <button class="btn primary" id="cbDoImport">Load item</button>
      </div></div>`;
    document.body.appendChild(ov);

    // wire
    document.getElementById('cbImport').onclick=()=>openImport();
    document.getElementById('cbCancel').onclick=()=>{ ov.classList.remove('on'); };
    ov.onclick=e=>{ if(e.target===ov) ov.classList.remove('on'); };
    document.getElementById('cbDoImport').onclick=doImport;
    document.getElementById('cbNewWhite').onclick=()=>{ const b=document.getElementById('baseSel').value; const il=+document.getElementById('ilvlIn').value||82; newItem(b,il); activeId=null; renderInv(); };
    document.getElementById('cbClearInv').onclick=()=>{ if(!INV.length)return; INV=[]; saveInv(); renderInv(); toast('Stash cleared'); };
    // hotkey: Ctrl/Cmd+D imports from clipboard; Esc closes the overlay
    document.addEventListener('keydown', e=>{
      if((e.ctrlKey||e.metaKey) && !e.shiftKey && !e.altKey && (e.key==='p'||e.key==='P')){ e.preventDefault(); quickImport(); }
      else if(e.key==='Escape'){ const ov=document.getElementById('cbOverlay'); if(ov&&ov.classList.contains('on')) ov.classList.remove('on'); }
    });
    // paste anywhere outside a text field that looks like an item → import
    document.addEventListener('paste', e=>{
      const t=e.target; if(t && (t.tagName==='TEXTAREA'||t.tagName==='INPUT'||t.isContentEditable)) return;
      const cd=e.clipboardData||window.clipboardData; const txt=cd?cd.getData('text'):'';
      if(looksLikeItem(txt)){ e.preventDefault(); importText(txt,'paste'); }
    });
    // hold Alt → show roll RANGES instead of the actual rolled values
    let altOn=false;
    const setAlt=v=>{ if(altOn===v) return; altOn=v; window.__altRange=v; if(typeof render==='function') render(); };
    window.addEventListener('keydown', e=>{ if(e.key==='Alt'){ e.preventDefault(); setAlt(true); } });
    window.addEventListener('keyup', e=>{ if(e.key==='Alt'){ e.preventDefault(); setAlt(false); } });
    window.addEventListener('blur', ()=>setAlt(false));

    // native (Electron) bridge: the OS-global Ctrl+P delivers clipboard text here
    if(window.cbNative && window.cbNative.onImport){
      document.body.classList.add('cb-native');
      window.cbNative.onImport(text=>{ try{
        if(looksLikeItem(text)) importText(text,'global hotkey');
        else { openImport(); const p=document.getElementById('cbPaste'); if(p&&text) p.value=text; }
      }catch(err){ console.warn('native import',err); } });
    }
    renderInv(); updateCoach(); renderPlanner();
  }

  function openImport(){ const ov=document.getElementById('cbOverlay'); document.getElementById('cbParseMsg').innerHTML=''; ov.classList.add('on'); setTimeout(()=>document.getElementById('cbPaste').focus(),30); }

  // Ctrl+P — read the clipboard and import straight away (Sidekick-style), with manual fallback
  function looksLikeItem(t){ return /(^|\n)\s*Rarity:/i.test(t||'') || /(^|\n)\s*Item Class:/i.test(t||''); }
  function importText(text, source){
    const res=parseItem(text);
    if(res.error){ openImport(); document.getElementById('cbPaste').value=text||''; const m=document.getElementById('cbParseMsg'); m.className='cbMsg bad'; m.innerHTML=res.error; return false; }
    if(!res.ok){ openImport(); document.getElementById('cbPaste').value=text||''; const m=document.getElementById('cbParseMsg'); m.className='cbMsg bad'; m.innerHTML=`Couldn’t match the base "<b>${res.baseName||'?'}</b>".`; return false; }
    const e=addToInv(res.item); loadItem(res.item, e.id);
    const mapped=res.item.prefixes.length+res.item.suffixes.length;
    let t=`Imported ${itemLabel(res.item)} — ${mapped} mod${mapped!==1?'s':''}`+(res.unmapped.length?`, ${res.unmapped.length} unrecognised`:'')+(source?` (${source})`:'');
    toast(t); return true;
  }
  async function quickImport(){
    let text='';
    try{ if(navigator.clipboard && navigator.clipboard.readText) text=await navigator.clipboard.readText(); }catch(e){ text=''; }
    if(looksLikeItem(text)){ importText(text,'clipboard'); return; }
    // clipboard empty/blocked/not an item → open the paste box
    openImport();
    const m=document.getElementById('cbParseMsg');
    if(text && text.trim()){ document.getElementById('cbPaste').value=text; }
    else { m.className='cbMsg'; m.innerHTML='Clipboard didn’t contain an item (or the browser blocked clipboard access on this page). Copy the item in-game with <b>Ctrl+C</b>, then paste here.'; }
  }
  function doImport(){
    const txt=document.getElementById('cbPaste').value;
    const res=parseItem(txt);
    const msg=document.getElementById('cbParseMsg');
    if(res.error){ msg.className='cbMsg bad'; msg.innerHTML=res.error; return; }
    if(!res.ok){ msg.className='cbMsg bad'; msg.innerHTML=`Couldn’t match the base type "<b>${res.baseName||'?'}</b>". Check it’s a PoE2 base in the dataset.`; return; }
    const mapped=res.item.prefixes.length+res.item.suffixes.length;
    const e=addToInv(res.item);
    let note=`Loaded <b>${itemLabel(res.item)}</b> — ${mapped} mod${mapped!==1?'s':''} matched`;
    if(res.unmapped.length) note+=`, ${res.unmapped.length} not recognised (${res.unmapped.slice(0,2).map(u=>'“'+u+'”').join(', ')}${res.unmapped.length>2?'…':''})`;
    if(res.droppedAffix) note+=`, ${res.droppedAffix} over the affix cap dropped`;
    msg.className='cbMsg good'; msg.innerHTML=note+'.';
    document.getElementById('cbOverlay').classList.remove('on');
    loadItem(res.item, e.id);
    toast('Item imported');
  }

  /* ---------- inventory grid ---------- */
  function renderInv(){
    const grid=document.getElementById('cbInvGrid'); if(!grid) return;
    if(!INV.length){ grid.innerHTML=`<div class="cbEmpty">No items yet. Import one from the game, or craft a base and it’ll appear here.</div>`; return; }
    grid.innerHTML=`<div class="cbItems">`+INV.map(e=>{
      const it=e.item, n=it.prefixes.length+it.suffixes.length, cap=(BASES[it.base]&&BASES[it.base].c==='Jewel'?2:3)*2;
      const cls='rarity-'+it.rarity;
      return `<button class="cbItem ${cls}${e.id===activeId?' active':''}" data-id="${e.id}">
        <span class="cbDel" data-del="${e.id}" title="Remove">×</span>
        <div class="cbItemName">${escapeHtml(e.label)}</div>
        <div class="cbItemBase">${escapeHtml(it.base)}</div>
        <div class="cbItemMeta">ilvl ${it.ilvl} · ${cap===6?'':''}<b>${n}</b>/${cap} mods · ${it.rarity}${it.corrupted?' · <span style="color:var(--corrupt)">corrupted</span>':''}</div>
      </button>`;
    }).join('')+`</div>`;
    grid.querySelectorAll('.cbItem').forEach(b=>{ b.onclick=ev=>{
      if(ev.target.dataset.del){ INV=INV.filter(x=>x.id!=ev.target.dataset.del); if(activeId==ev.target.dataset.del)activeId=null; saveInv(); renderInv(); return; }
      const e=INV.find(x=>x.id==b.dataset.id); if(e) loadItem(e.item, e.id);
    }; });
  }
  function escapeHtml(s){ return (''+s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  /* ---------- coach ---------- */
  function topMods(gen, n){
    const od=oddsFor(gen,0); return od.groups.slice(0,n).map(g=>({nm:familyShort(g.m), p:g.p})); }
  function familyShort(m){ let t=(m.disp||m.tx||''); return t.replace(/\((\d+)-(\d+)\)/g,'$1–$2').replace(/^\+/,''); }
  function updateCoach(){
    const box=document.getElementById('cbCoach'); if(!box) return;
    const st=document.getElementById('cbCoachState');
    if(!item){ box.innerHTML='<div class="cbHint">Load or import an item to get suggestions.</div>'; st.textContent='—'; return; }
    const cls=curBase().c, jewel=cls==='Jewel', cap=maxAff();
    const np=item.prefixes.length, ns=item.suffixes.length, n=np+ns;
    st.textContent=item.corrupted?'corrupted':item.rarity;
    const tips=[]; const rec=(t,why,kind)=>tips.push({t,why,kind:kind||''});
    if(item.corrupted){
      rec('This item is corrupted — crafting is locked.','Corruption is final in 0.5; there’s no uncorrupt. Vaal only as the very last step.','bad');
    } else if(item.rarity==='normal'){
      rec('Transmute to begin (Magic, +1 mod).','Then Augment a 2nd mod and Regal to Rare — that route shows odds at every step. Avoid Alchemy on gear you care about (4 random mods, no control).','good');
    } else if(item.rarity==='magic'){
      if(n<2) rec('Augment to add the 2nd mod.','A Magic item holds 1 prefix + 1 suffix; the Aug fills the open side. See the open-side pool in the odds panel.','good');
      rec('Regal to go Rare (keeps both mods, adds a 3rd).','Arm Sinistral/Dextral Coronation first if you want to force which side the new mod lands on.');
    } else if(item.rarity==='rare'){
      const op=cap-np, os=cap-ns;
      if(n>=cap*2){
        rec('Item is full — now refine.','Chaos swaps one mod (remove 1 + add 1), Annul removes one, Divine rerolls the numbers. Use omens to target a side.','good');
        rec('Lock the keepers, then remove the junk.','Fracture your good mods (they become immune to Annul/Chaos), then a side-omen + Annul can only hit the unwanted mod — deterministic removal.');
      } else {
        if(op>0||os>0) rec(`Exalt to add a mod (${op} prefix / ${os} suffix slot${op+os!==1?'s':''} open).`,'A blind Exalt picks a random open side — arm Sinistral (prefix) or Dextral (suffix) Exaltation to steer it, or Greater Exaltation to add two.','good');
        rec('Or use an Essence to guarantee a specific mod','instead of gambling the slam.');
      }
    }
    // surface the best available next add
    let pool='';
    if(!item.corrupted && (item.rarity==='magic'||item.rarity==='rare') && n<cap*2){
      const gen=(cap-np)>=(cap-ns)?'prefix':'suffix';
      const tops=topMods(gen,4).filter(x=>x.p>0);
      if(tops.length) pool=`<div class="cbPool"><div class="cbPoolHd">Most likely on the open ${gen}</div>`+
        tops.map(x=>`<div class="cbPoolRow"><span class="cbPct">${(x.p*100).toFixed(1)}%</span><span>${escapeHtml(x.nm)}</span></div>`).join('')+`</div>`;
    }
    box.innerHTML=tips.map(t=>`<div class="cbTip ${t.kind}"><div class="cbTipT">${t.t}</div><div class="cbTipW">${t.why}</div></div>`).join('')+pool;
  }

  /* ---------- planner ---------- */
  let targets=new Set();
  function renderPlanner(){
    const box=document.getElementById('cbPlanner'); if(!box) return;
    if(!item){ box.innerHTML='<div class="cbHint">Load an item, then pick the mods you’re chasing.</div>'; return; }
    if(item.corrupted){ box.innerHTML='<div class="cbHint">Corrupted item — nothing left to plan.</div>'; return; }
    // candidate families = union of eligible prefix + suffix groups
    const pre=oddsFor('prefix',0).groups, suf=oddsFor('suffix',0).groups;
    const cands=[...pre.map(g=>({g,side:'prefix'})),...suf.map(g=>({g,side:'suffix'}))]
      .sort((a,b)=>b.g.p-a.g.p).slice(0,40);
    const list=cands.map(({g,side})=>{
      const id=g.ty+'|'+side, on=targets.has(id);
      return `<label class="cbTarget ${on?'on':''}"><input type="checkbox" data-t="${id}" ${on?'checked':''}>
        <span class="cbTSide">${side[0].toUpperCase()}</span>
        <span class="cbTName">${escapeHtml(familyShort(g.m))}</span>
        <span class="cbTPct">${(g.p*100).toFixed(1)}%</span></label>`;
    }).join('');
    box.innerHTML=`<div class="cbHint">Tick the mods you want. Percentages are the chance a single add on that side rolls that family right now.</div>
      <div class="cbTargets">${list}</div><div id="cbPlanOut"></div>`;
    box.querySelectorAll('input[data-t]').forEach(c=>{ c.onchange=()=>{ const id=c.dataset.t; if(c.checked)targets.add(id); else targets.delete(id); planOut(); renderPlanner(); }; });
    planOut();
  }
  function planOut(){
    const out=document.getElementById('cbPlanOut'); if(!out) return;
    if(!targets.size){ out.innerHTML=''; return; }
    const pre=oddsFor('prefix',0), suf=oddsFor('suffix',0);
    const find=(ty,side)=>((side==='prefix'?pre:suf).groups.find(g=>g.ty===ty)||{}).p||0;
    const rows=[...targets].map(id=>{ const [ty,side]=id.split('|'); const p=find(ty,side);
      const g=(side==='prefix'?pre:suf).groups.find(x=>x.ty===ty);
      const ess=ESSENCE_DEFS.some(e=>e.ty===ty); // could this be guaranteed by an essence?
      return {ty,side,p,nm:g?familyShort(g.m):ty,ess}; });
    // chance a single side-targeted Exalt into a side hits ANY of that side's targets
    const byside={prefix:0,suffix:0};
    rows.forEach(r=>{ byside[r.side]=1-(1-byside[r.side])*(1-r.p); });
    const exP=rows.filter(r=>r.side==='prefix').length, exS=rows.filter(r=>r.side==='suffix').length;
    let html=`<div class="cbPlanHd">Plan</div>`;
    html+=rows.map(r=>`<div class="cbPlanRow"><span class="cbPct">${(r.p*100).toFixed(1)}%</span><span class="cbPlanNm">${escapeHtml(r.nm)} <em>(${r.side})</em></span>${r.ess?'<span class="cbGuar">essence ✓</span>':''}</div>`).join('');
    const steps=[];
    if(rows.some(r=>r.ess)) steps.push('Guarantee an essence-able target first with a <b>Greater/Perfect Essence</b> — removes the gamble for that mod.');
    if(exP>0) steps.push(`For prefixes, arm <b>Sinistral Exaltation</b> → Exalt: ~<b>${(byside.prefix*100).toFixed(1)}%</b> per slam to hit one of your ${exP} prefix target${exP>1?'s':''}.`);
    if(exS>0) steps.push(`For suffixes, arm <b>Dextral Exaltation</b> → Exalt: ~<b>${(byside.suffix*100).toFixed(1)}%</b> per slam to hit one of your ${exS} suffix target${exS>1?'s':''}.`);
    steps.push('Miss? <b>Annul</b> the wrong mod (fracture the good ones first so removal is safe) and slam again.');
    html+=`<div class="cbSteps">`+steps.map((s,i)=>`<div class="cbStep"><span>${i+1}</span><div>${s}</div></div>`).join('')+`</div>`;
    out.innerHTML=html;
  }

  /* ---------- hook the app's render so coach/planner stay in sync ---------- */
  const _render=render;
  window.render=function(){ _render.apply(this,arguments); try{ updateCoach(); renderPlanner(); renderInv(); }catch(e){ console.warn('CB hook',e); } };
  // also expose render globally is tricky (it's a function decl); patch via reference used by handlers:
  try{ render=window.render; }catch(e){}

  // expose for testing/debug + native bridge
  window.CB={ parseItem, matchModLine, matchBase, INV, loadItem, importText, quickImport, looksLikeItem };

  if(document.readyState==='complete'||document.readyState==='interactive') buildUI();
  else document.addEventListener('DOMContentLoaded', buildUI);
})();
