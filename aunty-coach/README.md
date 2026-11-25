# Aunty Coach 🍊

**Aunty Coach** is the AI customer service chatbot for **Aunty Approved**, a student start-up selling *First Bai Nian Kits* for Chinese New Year 2027. The kits are for young adults visiting their partner's family for CNY for the first time.

> "First time bai nian at their house? Aunty got you."

This project was built for **AIB (AI in Business) Assignment 1, Task 3** at Nanyang Polytechnic. It is the Python version of the original bot built in Botpress Studio.

## What it does

| Feature | How it works |
|---|---|
| Welcome message | Sent automatically when the chat starts |
| AI customer service | Claude answers questions about kits, prices, delivery, ordering, returns and CNY etiquette, in a warm Singlish "aunty" style |
| Knowledge Base | 3 documents in `knowledge/`. The bot only uses facts from these documents |
| Fallback | If the answer isn't in the Knowledge Base, the bot sends a fixed reply pointing to hello@auntyapproved.sg |
| Relative Calculator | Type `calculator`, then tap Dad / Mum / Older brother … one person at a time to get the title in Mandarin, Hokkien and Cantonese, plus what to say |

## How the Botpress bot maps to the code

```
Botpress                               Python
─────────────────────────────────────  ─────────────────────────────────────
Trigger: Conversation Started    ───►  WELCOME message in aunty_coach.py
Autonomous Node (instructions)   ───►  system_prompt.txt
Search Knowledge tool + KB docs  ───►  knowledge/*.md (given to the model)
Exit condition: "calculator"     ───►  wants_calculator()
Standard2 (init chain/calcDone)  ───►  calculator.new_state()
Standard3 (pick buttons)         ───►  calculator.BUTTONS
Standard4 (Execute Code card)    ───►  calculator.relative_calculator()
"user tapped Done" → back to AI  ───►  loop ends when calcDone == "yes"
```

## Project structure

```
aunty-coach/
├── aunty_coach.py        # main chatbot (run this)
├── calculator.py         # Aunty's Relative Calculator
├── system_prompt.txt     # Aunty Coach's personality and rules
├── knowledge/            # Knowledge Base documents
│   ├── 01_aunty_approved_knowledge_base.md
│   ├── 02_extra_faqs_and_etiquette.md
│   └── 03_family_tree_titles_and_greetings.md
├── requirements.txt
├── .env.example          # copy to .env and add your API key
└── .gitignore
```

## Setup

1. Install the packages (in a terminal or the Anaconda Prompt):
   ```
   pip install -r requirements.txt
   ```
2. Get an API key from https://console.anthropic.com
3. Copy `.env.example` to `.env` and paste your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Run it:
   - **Spyder:** open `aunty_coach.py` and press **F5**. Chat in the IPython console.
   - **Terminal:** `python aunty_coach.py`

The Relative Calculator works without an API key. You can test it on its own with `python calculator.py`.

## Example chat

```
Aunty: Gong Xi Fa Cai! Aunty Coach here 👋 ...
You: is delivery free for one classic kit?
Aunty: One Classic Kit (S$32) needs S$4.90 delivery leh. Hit S$50 and delivery is free ...
You: calculator
Aunty: Okay, Aunty's Relative Calculator! Start from your partner ...
Pick (number or name): 1        ← Dad
Pick (number or name): 3        ← Older brother
Pick (number or name): 8        ← Wife
Aunty: Your partner's dad's older brother's wife:
• Mandarin: 伯母 (bó mǔ)
• Hokkien: Ah Mm
• Cantonese: Pak Neung
```

## Notes

- Aunty Approved is a student project. Payments on the website are demo only.
- Never commit your `.env` file. It is already listed in `.gitignore`.
