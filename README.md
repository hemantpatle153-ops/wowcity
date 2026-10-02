# WowCity website

The public website for WowCity, with five pages: Home, Services, Why us, Download and Contact (Join), plus a 404 page.

It is plain HTML, CSS and JavaScript, so there is no framework and nothing to install. It runs on any static host, including InfinityFree, GitHub Pages and Cloudflare Pages.

## Change the content

| What | Where |
|---|---|
| Phone, WhatsApp, email, support hours, app links, domain | `src/site.json` |
| Page text | `src/pages/*.html` |
| Header, footer, FAQ, the "Join us today" band | `src/partials/*.html` |
| Colours, fonts, animations | `src/assets/css/style.css` |
| Interactions (billing demo, form, tabs, menu) | `src/assets/js/main.js` |

A WhatsApp number or phone number left empty in `src/site.json` is simply hidden. Write numbers with the country code, for example `+91 98765 43210`.

## Build and preview

```bash
node build.mjs --check   # builds dist/ and fails on any broken link
node serve.mjs           # preview at http://localhost:4173
```

## Deploy

The site runs on **Cloudflare Workers** with static assets, configured in `wrangler.jsonc`. Cloudflare is connected to this repository, so every push to `main` builds the site and publishes it automatically, usually within a minute.

The Cloudflare project settings are:

- Build command: `node build.mjs --check`
- Deploy command: `npx wrangler deploy`

Custom security and cache headers live in `src/static/_headers`. `src/static/.htaccess` is only for Apache hosts and is not uploaded to Cloudflare.

GitHub Actions (`.github/workflows/check.yml`) builds the site and checks every link on each push.

## Join form

The Join form posts to `/api/join`, which is handled by the Worker in `src/worker.js`. The Worker checks the fields and emails the request to `support@luzzan.com` through Resend, from `noreply@luzzan.com`. If the shop owner gave an email, replies go straight to them.

Two things need to be set up once:

1. **Resend API key.** In Cloudflare, open the `wowcity` Worker, go to Settings → Variables and Secrets, and add a secret named `RESEND_API_KEY`. The key comes from resend.com → API Keys and needs "Sending access" for luzzan.com.
2. **An inbox for support@luzzan.com.** In Cloudflare, open luzzan.com → Email → Email Routing, then forward `support@` to the Gmail you read.

If sending fails, the form falls back to WhatsApp (when a number is set in `src/site.json`) or opens an email to support.
