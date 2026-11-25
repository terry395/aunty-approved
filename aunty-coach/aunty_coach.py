# -*- coding: utf-8 -*-
"""
Aunty Coach - AI customer service chatbot for Aunty Approved (First Bai Nian Kits, CNY 2027)
AIB Assignment 1, Task 3

Python version of the Botpress bot:
  - Trigger "Conversation Started"  -> welcome message
  - Autonomous Node                 -> AI chat (Claude) with the system prompt + Knowledge Base
  - Exit condition "calculator"     -> Aunty's Relative Calculator (button loop)
  - "Done"                          -> back to the AI chat

Run in Spyder (F5) or in a terminal:  python aunty_coach.py
"""

import os
from pathlib import Path

from calculator import BUTTONS, new_state, relative_calculator

# Step 1: Settings
BASE_DIR = Path(__file__).resolve().parent
MODEL = os.getenv('AUNTY_MODEL', 'claude-haiku-5-5')   # change to another Claude model if you like
MAX_TOKENS = 600

WELCOME = ("Gong Xi Fa Cai! Aunty Coach here 👋 First time bai nian at their house? "
           "Don't worry lah, Aunty got you. Ask me about kits, prices or delivery, "
           "or type calculator to find out what to call every relative. What you want to know?")

CALC_INTRO = ("Okay, Aunty's Relative Calculator! Start from your partner, then pick one person at a time. "
              "Example: Dad → Older brother → Wife = what to call his wife.")

FALLBACK = ("Aiyoh, good question! Aunty don't want to anyhow say. Please email hello@auntyapproved.sg "
            "and the team will reply within 1 working day, okay?")


# Step 2: Load the API key from a .env file (if python-dotenv is installed)
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass


# Step 3: Load the system prompt and the Knowledge Base documents
def load_system_prompt():
    prompt = (BASE_DIR / 'system_prompt.txt').read_text(encoding='utf-8')
    kb_parts = []
    for f in sorted((BASE_DIR / 'knowledge').glob('*.md')):
        kb_parts.append('### ' + f.stem + '\n' + f.read_text(encoding='utf-8'))
    knowledge = '\n\n'.join(kb_parts)
    # In Botpress the bot used the "Search Knowledge" tool.
    # Here the whole Knowledge Base is small enough to give to the model directly.
    return prompt + '\n\n=== KNOWLEDGE BASE (your only source of facts) ===\n\n' + knowledge


# Step 4: Connect to Claude
def make_client():
    try:
        import anthropic
    except ImportError:
        print('[!] The anthropic package is not installed. Run:  pip install -r requirements.txt')
        return None
    if not os.getenv('ANTHROPIC_API_KEY'):
        print('[!] ANTHROPIC_API_KEY is not set. Copy .env.example to .env and paste your key.')
        print('    The Relative Calculator still works without a key.\n')
        return None
    return anthropic.Anthropic()


def ask_aunty(client, system_prompt, history):
    if client is None:
        return FALLBACK + '\n(AI chat is off because there is no API key. Type calculator to use the Relative Calculator.)'
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=history,
        )
        return ''.join(block.text for block in response.content if block.type == 'text').strip()
    except Exception as e:
        print('[!] API error:', e)
        return FALLBACK


# Step 5: Exit condition - does the user want the calculator?
def wants_calculator(text):
    t = text.lower()
    return 'calculator' in t or 'family tree step by step' in t


# Step 6: Relative Calculator loop (Standard2 -> Standard3 -> Standard4)
def run_calculator():
    state = new_state()            # workflow.chain = "", workflow.calcDone = "no"
    print('\nAunty:', CALC_INTRO)
    while state['calcDone'] != 'yes':
        print('\n' + '  '.join(f'[{i + 1}] {b}' for i, b in enumerate(BUTTONS)))
        choice = input('Pick (number or name): ').strip()
        if choice.isdigit() and 1 <= int(choice) <= len(BUTTONS):
            choice = BUTTONS[int(choice) - 1]
        else:
            # accept typed names in any case, e.g. "older brother"
            for b in BUTTONS:
                if choice.lower() == b.lower():
                    choice = b
        print('\nAunty:', relative_calculator(choice, state))
    return state


# Step 7: Main chat loop
def main():
    system_prompt = load_system_prompt()
    client = make_client()
    history = []

    print('Aunty:', WELCOME)
    print("(type 'quit' to exit)\n")

    while True:
        user_text = input('You: ').strip()
        if not user_text:
            continue
        if user_text.lower() in ('quit', 'exit', 'bye'):
            print('Aunty: Bye bye! Huat ah! 🍊')
            break

        if wants_calculator(user_text):
            run_calculator()
            # let the AI know what happened so the chat flows on naturally
            history.append({'role': 'user', 'content': user_text})
            history.append({'role': 'assistant', 'content': '(Customer used the Relative Calculator and tapped Done.)'})
            print()
            continue

        history.append({'role': 'user', 'content': user_text})
        reply = ask_aunty(client, system_prompt, history)
        history.append({'role': 'assistant', 'content': reply})
        print('\nAunty:', reply, '\n')


if __name__ == '__main__':
    main()
