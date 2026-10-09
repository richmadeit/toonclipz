(()=>{
  const styles=Object.freeze({'gta-cinematic':'GTA-Inspired Cinematic','red-room':'Original ToonClipz - Red room','pink-stage':'Original ToonClipz - Pink room','beach':'Original ToonClipz - Beach','concert-stage':'Original ToonClipz - Concert','characters':'Cinematic Animal Characters','custom':'My own idea'});
  const prefix='toonclipz_style_v1',lifetime=7*24*60*60*1000;
  const safeRef=ref=>/^TC-(15|30|60|180)-[a-f0-9]{16}$/.test(ref||'');
  function load(key){try{const raw=localStorage.getItem(key);if(!raw)return undefined;const p=JSON.parse(raw);if(!p||!Number.isFinite(p.savedAt)||p.savedAt>Date.now()||Date.now()-p.savedAt>lifetime||!(p.id===null||Object.hasOwn(styles,p.id))){localStorage.removeItem(key);return undefined;}return p.id;}catch{return undefined;}}
  function write(id,ref){if(id!==null&&!Object.hasOwn(styles,id))return;try{localStorage.setItem(prefix+(safeRef(ref)?':'+ref:''),JSON.stringify({id,savedAt:Date.now()}));}catch{}}
  function read(ref){if(safeRef(ref)){const id=load(prefix+':'+ref);if(id!==undefined)return id;}return load(prefix)||null;}
  window.toonclipzPortfolio=Object.freeze({styles,read,choose:id=>write(id),rememberOrder:ref=>{if(safeRef(ref))write(read(),ref);}});
})();
