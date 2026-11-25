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
| `coach-widget.js` / `coach-widget.css` | Aunty Coach chat bubble + window, incl. the Relative Calculator |
| `netlify/functions/aunty-coach/` | Server-side chat endpoint (`/api/aunty-coach`) that talks to Claude. Holds no secrets. |
| `aunty-coach/` | The original Python version of Aunty Coach + its system prompt and Knowledge Base (the website uses the same files) |
| `scripts/`, `tests/`, `package.json` | Keeps the website bot in sync with `aunty-coach/`, and tests |

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

The 🍊 bubble (bottom-right) and every "Chat with Aunty Coach" button open the chat.

- **AI answers** come from `netlify/functions/aunty-coach/`, which sends the chat to Claude with Aunty's system prompt and Knowledge Base. The API key stays on Netlify and is never sent to the browser.
- **Relative Calculator** (type `calculator`) runs in the browser, so it works even without an API key.

### Turn on the AI (one time)

1. Get an API key from https://console.anthropic.com
2. In Netlify: **Site configuration → Environment variables → Add a variable**: `ANTHROPIC_API_KEY` = your key. Scope it to **Functions**.
3. Redeploy (Deploys → Trigger deploy).

Until the key is set, Aunty politely points people to hello@auntyapproved.sg and the calculator still works. Optional: `AUNTY_MODEL` to change the Claude model (default `claude-haiku-5-5`).

Safety limits built in: only this website can call the endpoint, max 15 messages per minute per visitor, messages capped at 1000 characters, last 20 turns only, errors never shown to visitors.

### Changing what Aunty knows

Edit `aunty-coach/system_prompt.txt` or `aunty-coach/knowledge/*.md` (the Python bot uses them too), then run:

```bash
npm run build:knowledge
```

Run the tests with `npm test`. They also check the browser calculator gives the same answers as `aunty-coach/calculator.py`.

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. (The AI chat needs Netlify: use `npx netlify dev` to run the function locally too. The calculator works either way.)
