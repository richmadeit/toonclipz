import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../song-picker.js',import.meta.url),'utf8');
function setup(){
  const els=new Map(),revoked=[],timers=new Map();let nextTimer=0;
  const el=id=>{
    if(!els.has(id))els.set(id,{value:'',textContent:'',checked:false,disabled:false,files:[],listeners:{},attributes:{},duration:NaN,currentTime:0,playbackRate:1,paused:true,
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
      async emit(type){for(const fn of this.listeners[type]||[])await fn();},
      setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},
      setCustomValidity(message){this.validationMessage=message;},focus(){this.focused=true;},load(){},
      pause(){this.paused=true;},async play(){this.paused=false;}
    });return els.get(id);
  };
  el('songStartTime').value='0:00';
  const window={};
  vm.runInContext(source,vm.createContext({document:{getElementById:el},window,
    URL:{createObjectURL:file=>'blob:'+file.name,revokeObjectURL:url=>revoked.push(url)},
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)
  }));
  return {el,revoked,timers,picker:window.toonclipzSongPicker,
    async file(name='song.mp3',duration=180){el('song').files=[{name}];await el('song').emit('change');if(duration!==null){el('songPreview').duration=duration;await el('songPreview').emit('loadedmetadata');}},
    async slide(seconds){el('songStart').value=String(seconds);await el('songStart').emit('input');}
  };
}
test('selecting a hook at 0:43 preserves an explicit 0:43–0:58 preview and requires confirmation',async()=>{
  const h=setup();await h.file();await h.slide(43);
  assert.equal(h.el('songSelection').textContent,'0:43–0:58');
  assert.match(h.picker.validate(),/check/);assert.equal(h.picker.getSelection(),null);
  h.el('confirmSongSection').checked=true;assert.equal(h.picker.validate(),'');
  assert.equal(JSON.stringify(h.picker.getSelection()),JSON.stringify({start:'0:43',end:'0:58'}));
  await h.slide(44);assert.equal(h.el('confirmSongSection').checked,false);
});
test('moving the selection stops playback; playback is limited to the selected 15 seconds',async()=>{
  const h=setup();await h.file();await h.slide(43);await h.el('playSongSelection').emit('click');
  assert.equal(h.el('songPreview').currentTime,43);assert.equal(h.el('songPreview').paused,false);
  assert.equal([...h.timers.values()][0].ms,15000);
  h.el('songPreview').currentTime=58;await h.el('songPreview').emit('timeupdate');
  assert.equal(h.el('songPreview').paused,true);assert.equal(h.timers.size,0);
  await h.el('playSongSelection').emit('click');await h.slide(60);
  assert.equal(h.el('songPreview').paused,true);
});
test('last section cannot extend past the song; short songs use only their actual length',async()=>{
  const h=setup();await h.file('song.mp3',60);assert.equal(h.el('songStart').max,'45');
  h.el('songStartTime').value='0:46';await h.el('songStartTime').emit('input');
  h.el('confirmSongSection').checked=true;assert.equal(h.picker.getSelection(),null);
  assert.match(h.picker.validate(),/0:45/);
  await h.file('short.mp3',9.5);h.el('confirmSongSection').checked=true;
  assert.equal(h.el('songStart').disabled,true);
  assert.equal(JSON.stringify(h.picker.getSelection()),JSON.stringify({start:'0:00',end:'0:09.5'}));
});
test('unplayable files accept exact manual timestamps and reject malformed times',async()=>{
  const h=setup();await h.file('recording.mov',null);await h.el('songPreview').emit('error');
  assert.equal(h.el('playSongSelection').disabled,true);
  h.el('songStartTime').value='1:09.5';await h.el('songStartTime').emit('input');h.el('confirmSongSection').checked=true;
  assert.equal(JSON.stringify(h.picker.getSelection()),JSON.stringify({start:'1:09.5',end:'1:24.5'}));
  for(const time of ['1:60','hook','-1:00','NaN','Infinity']){
    h.el('songStartTime').value=time;await h.el('songStartTime').emit('input');
    assert.notEqual(h.picker.validate(),'');assert.equal(h.picker.getSelection(),null);
  }
});
test('replacing or removing a file clears stale confirmation and releases the old file',async()=>{
  const h=setup();await h.file('first.mp3');await h.slide(43);h.el('confirmSongSection').checked=true;
  await h.file('second.mp3');assert.equal(h.el('confirmSongSection').checked,false);
  assert.equal(h.el('songStartTime').value,'0:00');assert.deepEqual(h.revoked,['blob:first.mp3']);
  h.el('song').files=[];await h.el('song').emit('change');
  assert.equal(h.el('songSection').hidden,true);assert.equal(h.picker.validate(),'');
  assert.equal(h.picker.getSelection(),null);assert.equal(h.el('confirmSongSection').required,false);
});
