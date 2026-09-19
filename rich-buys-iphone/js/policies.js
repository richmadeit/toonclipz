(async()=>{const c=await RBIUI.config();const p=document.querySelector('#returnsPolicy');if(p&&c.returnsPolicy)p.textContent=c.returnsPolicy;})();
