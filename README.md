# Aunty Approved · First Bai Nian Kit (CNY 2027)

A mobile-first online shop for young couples in Singapore visiting their partner's family for the first time at Chinese New Year 2027. It's plain HTML, CSS and JavaScript, with no build step.

| File | What it is |
| --- | --- |
| `index.html` | The whole shop: hero, story, shop, Aunty Coach, checkout, FAQ, policies |
| `styles.css` | All styling (mobile-first) |
| `script.js` | Cart, checkout, demo payment, order saving. **Edit products, prices and dates in the `CONFIG` object at the top.** |
| `google-apps-script.gs` | Paste into Google Sheets so orders are saved as rows and customers get an email |
| `assets/` | Kit illustrations (SVG). Replace with your own images. |
| `screenshots/` | Test screenshots (mobile + desktop) for the report |
| `netlify.toml` | Netlify hosting config (no build, publish the root) |

## Placeholders to replace

| Placeholder | Where |
| --- | --- |
| `PASTE_YOUR_APPS_SCRIPT_URL_HERE` | `ORDERS_SHEET_URL`, top of `script.js` |
| Instagram `@auntyapproved.sg` (fictional, links to instagram.com) | `index.html`: search `auntyapproved.sg` (footer, checkout section) |
| Email `hello@auntyapproved.sg` (fictional, links to gmail.com) | `index.html`: search `hello@auntyapproved.sg` (footer, checkout, FAQ, all three policies) |
| `[DEMO-UEN-000000000X]` | `CONFIG.payment.demoUen` in `script.js` (keep it fake) |
| Kit images (done) | `assets/starter-kit.jpg`, `classic-kit.jpg`, `meet-the-parent-kit.jpg`. To change one, upload a new file and update `image:` in `CONFIG.products` |

## Testing different dates

`CONFIG.allowTimeTravel` is on, so you can preview other dates (Singapore time):

- `?now=2027-01-05T12:00` shows usual prices and the "Order by 30 Jan" bar
- `?now=2027-01-31T00:05` shows orders closed

Set `allowTimeTravel: false` before launch if you don't want people to be able to do this.

## Aunty Coach chatbot

Aunty Coach is built in Botpress and embedded just before `</body>` in `index.html`. The chat bubble appears bottom-right, and every "Chat with Aunty Coach" button opens it. If the Botpress bubble can't load, the buttons open the shareable chat page in a new tab instead.

To change the bot, edit it in Botpress Studio and publish. The website picks up the changes automatically. If Botpress ever gives you a new embed code, replace the two Botpress `<script>` lines in `index.html` (and the link inside `openAuntyCoachWidget`).

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.
