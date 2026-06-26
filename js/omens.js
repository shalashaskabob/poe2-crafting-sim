function renderOmens(){
  const tray=document.getElementById('omentray');
  const order=['sinExalt','dexExalt','grtExalt','sinAnnul','dexAnnul','sinErase','dexErase','whittle',
    'sinCoron','dexCoron','sinNecro','dexNecro','sinCryst','dexCryst','echoes','sanctify','light',
    'blackblooded','liege','sovereign'].filter(id=>OMEN_NAMES[id]);
  const disp=id=>OMEN_NAMES[id].startsWith('of ')?('Omen '+OMEN_NAMES[id]):('Omen of '+OMEN_NAMES[id]);
  const cells=order.map(id=>{
    const armed=activeOmens.has(id);
    const src=(typeof IMG_DATA!=='undefined'&&IMG_DATA['omen_'+id+'.webp'])||'';
    return `<button class="cell omen${armed?' armed':''}" data-omen="${id}" data-nm="${escA(disp(id))}" data-ds="${escA(OMENS[id]||'')}" data-color="#9fe0b4"><img src="${src}" alt="" draggable="false"></button>`;
  });
  tray.innerHTML=`<div class="stash"><div class="invgrid">${cells.join('')}</div></div>`;
  const grid=tray.querySelector('.invgrid');
  const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const rem=(cols-(cells.length%cols))%cols; let pad='';
  for(let i=0;i<rem;i++) pad+='<div class="cell empty"></div>';
  grid.insertAdjacentHTML('beforeend',pad);
  tray.querySelectorAll('.cell[data-omen]').forEach(btn=>{
    btn.addEventListener('mouseenter',ev=>{ showTip(btn.dataset.nm,btn.dataset.ds,'',btn.dataset.color); moveTip(ev); });
    btn.addEventListener('mousemove',moveTip); btn.addEventListener('mouseleave',hideTip);
    btn.onclick=()=>{ const id=btn.dataset.omen; if(activeOmens.has(id))activeOmens.delete(id); else activeOmens.add(id); hideTip(); render();
      if(activeOmens.has(id))document.getElementById('predict').innerHTML=`<b>Armed — ${disp(id)}:</b> ${OMENS[id]}`; };
  });
}
const OMEN_NAMES={sinExalt:'Sinistral Exaltation',dexExalt:'Dextral Exaltation',grtExalt:'Greater Exaltation',
  sinAnnul:'Sinistral Annulment',dexAnnul:'Dextral Annulment',sinErase:'Sinistral Erasure',dexErase:'Dextral Erasure',
  whittle:'Whittling',sinCoron:'Sinistral Coronation',dexCoron:'Dextral Coronation',sinNecro:'Sinistral Necromancy',
  dexNecro:'Dextral Necromancy',sinCryst:'Sinistral Crystallisation',dexCryst:'Dextral Crystallisation',
  echoes:'Abyssal Echoes',sanctify:'Sanctification',light:'of Light',blackblooded:'of the Blackblooded',liege:'of the Liege',sovereign:'of the Sovereign'};
const OMENS={sinExalt:'Next Exalt adds a prefix only.',dexExalt:'Next Exalt adds a suffix only.',grtExalt:'Next Exalt adds two mods.',
  sinAnnul:'Next Annul removes a prefix only.',dexAnnul:'Next Annul removes a suffix only.',sinErase:'Next Chaos removes a prefix only.',
  dexErase:'Next Chaos removes a suffix only.',whittle:'Next Chaos removes the lowest item-level mod.',sinCoron:'Next Regal adds a prefix only.',
  dexCoron:'Next Regal adds a suffix only.',sinNecro:'Next desecration adds a prefix only.',dexNecro:'Next desecration adds a suffix only.',
  sinCryst:'Next Perfect Essence removes a prefix.',dexCryst:'Next Perfect Essence removes a suffix.',echoes:'Reveal offers a one-time reroll.',
  sanctify:'Next Divine Sanctifies (×0.78–1.22, locks).',light:'Next Annul removes only a Desecrated mod.',
  blackblooded:'Desecration draws from Kurgal.',liege:'Desecration draws from Amanamu.',sovereign:'Desecration draws from Ulaman.'};

