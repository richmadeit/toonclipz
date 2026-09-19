/* ToonClipz results, 2026-09-19. No changes to intake, payment, or tracking. */
(() => {
  'use strict';
  function mountResults() {
    const showcase = document.getElementById('watch');
    if (!showcase || document.getElementById('results')) return;
    const css = document.createElement('style');
    css.id = 'toon-results-css';
    css.textContent = `
      .tc-proof{margin:0 0 60px;padding:38px 0 10px;border-top:2px solid var(--ink,#22162f);scroll-margin-top:24px;color:var(--ink,#22162f)}
      .tc-proof-head{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:25px}
      .tc-proof .eyebrow{margin:0 0 12px}
      .tc-proof h2{font:700 clamp(32px,4.4vw,49px)/1.08 'Space Grotesk',sans-serif;letter-spacing:-2px;margin:0 0 15px;max-width:17ch}
      .tc-proof h2 em{font-style:normal;color:var(--gold,#6834e8)}
      .tc-proof-intro{color:var(--muted,#625a6b);max-width:50ch;font-size:17px;line-height:1.55;margin:0}
      .tc-proof-total{background:var(--lime,#ddfa6b);border:2px solid var(--ink,#22162f);border-radius:14px;box-shadow:4px 4px 0 var(--ink,#22162f);padding:21px 24px;flex:0 0 230px}
      .tc-proof-total strong{display:block;font:700 51px/1 'Space Grotesk',sans-serif;letter-spacing:-2.5px;margin-bottom:9px}
      .tc-proof-total span{display:block;font-size:14px;line-height:1.4}
      .tc-proof-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:19px}
      .tc-proof-card{min-width:0;background:#fffdf8;border:2px solid var(--ink,#22162f);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
      .tc-proof-tag{padding:12px 16px;background:#eee7ff;border-bottom:2px solid var(--ink,#22162f);font:700 11px/1.4 'Space Grotesk',sans-serif;letter-spacing:.045em}
      .tc-proof-featured .tc-proof-tag{background:var(--lime,#ddfa6b)}
      .tc-proof-body{padding:19px 17px 0}
      .tc-proof-card h3{font:700 19px/1.25 'Space Grotesk',sans-serif;letter-spacing:-.4px;margin:0 0 14px}
      .tc-proof-views{margin:0 0 16px;font-size:14px;color:var(--muted,#625a6b)}
      .tc-proof-views strong{font:700 42px/1 'Space Grotesk',sans-serif;letter-spacing:-1.8px;color:var(--gold,#6834e8);display:block;margin-bottom:5px}
      .tc-proof-metrics{margin:0 0 18px;display:grid;grid-template-columns:1fr 1fr;gap:11px}
      .tc-proof-metrics div{border-top:1px solid #ddd3e4;padding-top:8px}
      .tc-proof-metrics dt{font-size:12px;color:var(--muted,#625a6b)}
      .tc-proof-metrics dd{margin:1px 0 0;font:700 19px/1.3 'Space Grotesk',sans-serif}
      .tc-proof-evidence{display:block;margin:auto 12px 0;background:#f2f2f2;border:1px solid #ded8e4;border-radius:9px;overflow:hidden;text-decoration:none;color:var(--ink,#22162f)}
      .tc-proof-evidence img{display:block;width:100%;height:325px;object-fit:contain;background:#f2f2f2}
      .tc-proof-featured .tc-proof-evidence img{background:#000}
      .tc-proof-evidence span{display:block;padding:11px 8px;text-align:center;font-size:13px;font-weight:700;color:var(--gold,#6834e8);border-top:1px solid #ded8e4}
      .tc-proof-caption{margin:11px 17px 17px;color:var(--muted,#625a6b);font-size:12px;line-height:1.45}
      .tc-proof-actions{display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap;margin-top:26px}
      .tc-proof-actions .apply-link{display:inline-block;text-decoration:none;text-align:center;margin:0}
      .tc-proof-note{font-size:12px;line-height:1.6;color:var(--muted,#625a6b);margin:24px 0 0;max-width:100ch}
      .tc-proof-hero-link{display:inline-block;margin-top:15px;color:var(--gold,#6834e8);font-weight:700;font-size:13px;text-underline-offset:4px}
      .tc-proof-dialog{width:min(94vw,520px);max-height:92vh;padding:15px;background:#fffdf8;border:2px solid #22162f;border-radius:15px;overflow:auto;color:#22162f}
      .tc-proof-dialog::backdrop{background:rgba(18,10,28,.82)}
      .tc-proof-dialog-head{position:sticky;top:-15px;background:#fffdf8;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0 13px;z-index:1}
      .tc-proof-dialog h2{font:700 16px/1.4 'Space Grotesk',sans-serif;margin:0}
      .tc-proof-dialog button{font:700 14px 'Barlow',sans-serif;cursor:pointer;color:#22162f;background:#ddfa6b;border:2px solid #22162f;border-radius:7px;min-width:66px;min-height:44px}
      .tc-proof-dialog img{display:block;width:100%;height:auto;border-radius:8px}
      .tc-proof-dialog p{font-size:12px;line-height:1.5;margin:12px 0 3px}
      @media(max-width:850px){.tc-proof-head{align-items:flex-start;flex-direction:column}.tc-proof-total{flex:auto;width:100%;display:flex;align-items:center;gap:20px}.tc-proof-total strong{margin:0;flex-shrink:0}.tc-proof-grid{gap:12px}.tc-proof-body{padding:17px 12px 0}.tc-proof-evidence{margin-inline:8px}.tc-proof-evidence img{height:290px}.tc-proof-tag{padding:12px}.tc-proof-caption{margin-inline:12px}}
      @media(max-width:640px){.tc-proof{padding-top:28px;margin-bottom:38px}.tc-proof h2{font-size:38px;letter-spacing:-1.5px}.tc-proof-total{padding:18px}.tc-proof-total strong{font-size:43px}.tc-proof-total span{font-size:13px}.tc-proof-grid{grid-template-columns:1fr;gap:20px}.tc-proof-card{max-width:440px;width:100%;margin:auto}.tc-proof-body{padding:20px 19px 0}.tc-proof-evidence{margin-inline:17px}.tc-proof-evidence img{height:345px}.tc-proof-caption{margin-inline:19px}.tc-proof-actions{align-items:stretch;flex-direction:column}.tc-proof-actions .text-link{text-align:center;min-height:44px;padding:10px}.tc-proof-intro{font-size:16px}}
    `;
    document.head.appendChild(css);
    const section = document.createElement('section');
    section.id = 'results';
    section.className = 'tc-proof';
    section.setAttribute('aria-labelledby', 'tc-proof-title');
    section.innerHTML = `
      <div class="tc-proof-head">
        <div><p class="eyebrow">THE RECEIPTS · ACTUAL TOONCLIPZ POSTS</p>
          <h2 id="tc-proof-title">Cartoon clips that <em>get noticed.</em></h2>
          <p class="tc-proof-intro">The style gets your attention. These posts show the results. See the views, shares and creator repost in our actual TikTok screenshots.</p>
        </div>
        <div class="tc-proof-total"><strong>≈361K</strong><span>Combined video views<br>across the 3 posts below</span></div>
      </div>
      <div class="tc-proof-grid">
        <article class="tc-proof-card tc-proof-featured">
          <div class="tc-proof-tag">↻ REPOSTED BY TOTA MC</div>
          <div class="tc-proof-body"><h3>A cartoon conversation.</h3>
            <p class="tc-proof-views"><strong>284.9K</strong>views on one ToonClipz post</p>
            <dl class="tc-proof-metrics"><div><dt>Likes</dt><dd>26K</dd></div><div><dt>Saves</dt><dd>1,069</dd></div></dl>
          </div>
          <a class="tc-proof-evidence" href="assets/proof/tota-repost.avif" target="_blank" rel="noopener" data-proof-title="Tota Mc repost · 284.9K views" data-proof-note="Post screenshot showing the Tota Mc repost badge and engagement counts. This is a cartoon conversation post, not the DDG music-video example. Historical $25/clip pricing appears in the original post; the current offer is shown on this page." aria-label="Enlarge the screenshot showing Tota Mc reposted, 284.9K views, 26K likes and 1,069 saves">
            <img src="assets/proof/tota-repost.avif" width="416" height="903" loading="lazy" decoding="async" alt="ToonClipz TikTok post with the visible Tota Mc reposted badge, 284.9K views, 26K likes and 1,069 saves."><span>Open the repost proof ↗</span>
          </a>
          <p class="tc-proof-caption">The “Tota Mc reposted” badge is visible in the screenshot. Previous post; historical $25/clip pricing shown.</p>
        </article>
        <article class="tc-proof-card">
          <div class="tc-proof-tag">MUSIC VIDEO · 15.10 SECONDS</div>
          <div class="tc-proof-body"><h3>A short clip. Real attention.</h3>
            <p class="tc-proof-views"><strong>39K</strong>views on this music-video post</p>
            <dl class="tc-proof-metrics"><div><dt>Likes</dt><dd>1,235</dd></div><div><dt>Shares</dt><dd>213</dd></div><div><dt>Saves</dt><dd>219</dd></div><div><dt>New followers</dt><dd>48</dd></div></dl>
          </div>
          <a class="tc-proof-evidence" href="assets/proof/music-39k.avif" target="_blank" rel="noopener" data-proof-title="15.10-second music post · 39K views" data-proof-note="TikTok Studio screenshot: post published July 12, 2026; analytics updated September 18, 2026. Includes 7.5-second average watch time and 14.25% full-video completion." aria-label="Enlarge the TikTok Studio screenshot showing 39K views, 213 shares and 48 new followers">
            <img src="assets/proof/music-39k.avif" width="416" height="903" loading="lazy" decoding="async" alt="TikTok Studio analytics for a 15.10-second ToonClipz music video: 39K views, 1,235 likes, 61 comments, 213 shares, 219 saves and 48 new followers."><span>Open the actual analytics ↗</span>
          </a>
          <p class="tc-proof-caption">Posted July 12, 2026. TikTok Studio metrics updated September 18, 2026.</p>
        </article>
        <article class="tc-proof-card">
          <div class="tc-proof-tag">MUSIC VIDEO · 45.19 SECONDS</div>
          <div class="tc-proof-body"><h3>Another post. More proof.</h3>
            <p class="tc-proof-views"><strong>37.2K</strong>views on this music-video post</p>
            <dl class="tc-proof-metrics"><div><dt>Likes</dt><dd>2,106</dd></div><div><dt>Shares</dt><dd>49</dd></div><div><dt>Saves</dt><dd>150</dd></div><div><dt>New followers</dt><dd>18</dd></div></dl>
          </div>
          <a class="tc-proof-evidence" href="assets/proof/music-37k.avif" target="_blank" rel="noopener" data-proof-title="45.19-second music post · 37.2K views" data-proof-note="TikTok Studio screenshot: post published July 9, 2026; analytics updated September 18, 2026. Includes 9.0-second average watch time and 5.56% full-video completion. This older example is longer than the current 15-second offer." aria-label="Enlarge the TikTok Studio screenshot showing 37.2K views, 2,106 likes and 18 new followers">
            <img src="assets/proof/music-37k.avif" width="416" height="903" loading="lazy" decoding="async" alt="TikTok Studio analytics for a 45.19-second ToonClipz music video: 37.2K views, 2,106 likes, 49 comments, 49 shares, 150 saves and 18 new followers."><span>Open the actual analytics ↗</span>
          </a>
          <p class="tc-proof-caption">Posted July 9, 2026. Earlier, longer example; the current preview offer is 15 seconds.</p>
        </article>
      </div>
      <div class="tc-proof-actions"><a class="apply-link" href="#previewIntent">Get my cartoon preview ↗</a><a class="text-link" href="https://www.tiktok.com/@toon_clipz_?lang=en" target="_blank" rel="noopener noreferrer">Visit @toon_clipz_ on TikTok ↗</a></div>
      <p class="tc-proof-note">Selected past results from ToonClipz posts, shown as captured in the supplied screenshots. Combined views are approximate, not unique viewers. Results vary; views, followers and sales are not guaranteed. The Tota Mc repost applies to the conversation post shown, not the DDG example, and does not imply endorsement or partnership.</p>
    `;
    showcase.insertAdjacentElement('afterend', section);
    // Keep the DDG showcase; do not bring unrelated portfolio videos back.
    document.querySelector('.portfolio-more')?.remove();
    const hero = document.querySelector('.hero-copy');
    if (hero) {
      const link = document.createElement('a');
      link.href = '#results';
      link.className = 'tc-proof-hero-link';
      link.textContent = 'About 361K views across 3 posts. See the proof ↗';
      hero.appendChild(link);
    }
    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal === 'function') {
      dialog.className = 'tc-proof-dialog';
      dialog.setAttribute('aria-labelledby', 'tc-proof-dialog-title');
      dialog.innerHTML = '<div class="tc-proof-dialog-head"><h2 id="tc-proof-dialog-title"></h2><button type="button" aria-label="Close screenshot">Close ✕</button></div><img alt=""><p></p>';
      document.body.appendChild(dialog);
      const close = () => dialog.close();
      dialog.querySelector('button').addEventListener('click', close);
      dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); } });
      section.querySelectorAll('.tc-proof-evidence').forEach(link => {
        link.addEventListener('click', event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          const img = dialog.querySelector('img');
          img.src = link.getAttribute('href');
          img.alt = link.querySelector('img').alt;
          dialog.querySelector('h2').textContent = link.dataset.proofTitle;
          dialog.querySelector('p').textContent = link.dataset.proofNote;
          dialog.showModal();
          dialog.scrollTop = 0;
        });
      });
    }
    if (window.location.hash === '#results') section.scrollIntoView({behavior:'instant',block:'start'});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountResults, {once:true});
  else mountResults();
})();
(() => {
  const slider=document.getElementById('revealSlider');
  const layer=document.getElementById('beforeLayer');
  const divider=document.getElementById('divider');
  const reveal=value=>{const v=Math.max(0,Math.min(100,Number(value)));slider.value=v;layer.style.clipPath=`inset(0 ${100-v}% 0 0)`;divider.style.left=v+'%';slider.setAttribute('aria-valuetext',v+' percent photo');document.querySelectorAll('[data-reveal]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.reveal)===v?'true':'false'));};
  slider.addEventListener('input',()=>reveal(slider.value));
  document.querySelectorAll('[data-reveal]').forEach(b=>b.addEventListener('click',()=>reveal(b.dataset.reveal)));
  reveal(slider.value);
  const video=document.getElementById('showreel');
  const status=document.getElementById('videoStatus');
  const fallback=()=>{status.textContent='Having trouble playing? Open the video below.';document.querySelector('.video-fallback').hidden=false;};
  video.addEventListener('error',fallback);video.querySelector('source').addEventListener('error',fallback);
  video.addEventListener('play',()=>{status.textContent='Now playing · Full 15-second example';if(typeof audioEl!=='undefined'&&audioEl)audioEl.pause();});
  video.addEventListener('ended',()=>{status.textContent='Your song could be next. Apply below.';});
  document.getElementById('pbtn').addEventListener('click',()=>video.pause());
  const form=document.getElementById('f');
  form.addEventListener('submit',()=>video.pause());
  const receipt=document.getElementById('receipt');
  new MutationObserver(()=>{if(receipt.style.display==='block')document.querySelector('.mobile-cta').hidden=true;}).observe(receipt,{attributes:true,attributeFilter:['style']});
})();
