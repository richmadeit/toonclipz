# Toon Method TikTok tracker setup

The public `/toon-method/` page has two comparison sliders and a TikTok proof card. The card always links to Rich's actual profile, `https://www.tiktok.com/@toon_clipz_?lang=en`. It displays on-page views/likes only when the official TikTok Display API returns them. No values are invented or sourced from website traffic.

## To turn on automatic counts

1. Register/approve a TikTok for Developers app with Login Kit and Display API and request `video.list` for Rich's ToonClipz account. Log into the exact `@toon_clipz_` account and authorize that app. Do not use a different TikTok account.
2. Store the app's `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, and the account's authorized `TIKTOK_REFRESH_TOKEN` in **Netlify environment variables**, server side only. Never commit or place tokens in HTML or DM. Initial authorization/code exchange follows TikTok's Login Kit documentation; a profile URL by itself does not grant API access.
3. Redeploy. The Netlify function refreshes the short-lived access token and stores rotated credentials privately in Netlify Blobs. It requests the most recent 20 public videos and caches results for 15 minutes. The site shows combined views/likes for those 20 posts, the latest three per-post metrics and links, and the last check time.

The free public site remains honest before authorization: a link to the real TikTok profile appears, with an explanation that on-page counts require connection. No counts render from stale handwritten figures. If TikTok revokes access, token renewal fails, or TikTok changes its API, the direct profile link remains.

Official docs: https://developers.tiktok.com/docs/en/display-api-get-started ; https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list ; https://developers.tiktok.com/docs/en/oauth-user-access-token-management .
