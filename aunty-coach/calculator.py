# -*- coding: utf-8 -*-
"""
Aunty's Relative Calculator
Python version of the Botpress "Execute Code" card (Aunty Coach relative calculator v2).

The user starts from their partner and picks one person at a time,
e.g. Dad -> Older brother -> Wife, and Aunty gives the title in
Mandarin, Hokkien and Cantonese plus what to say.
"""

import re

# Step 1: Button labels the user can pick (same as the Botpress choice card)
BUTTONS = ['Dad', 'Mum', 'Older brother', 'Younger brother', 'Older sister',
           'Younger sister', 'Husband', 'Wife', 'Daughter', 'Son',
           'Start over', 'Done']

MAP = {'Dad': 'f', 'Mum': 'm', 'Older brother': 'ob', 'Younger brother': 'yb',
       'Older sister': 'os', 'Younger sister': 'ys', 'Husband': 'h', 'Wife': 'w',
       'Son': 's', 'Daughter': 'd'}

NAME = {'f': 'dad', 'm': 'mum', 'ob': 'older brother', 'yb': 'younger brother',
        'os': 'older sister', 'ys': 'younger sister', 'h': 'husband', 'w': 'wife',
        's': 'son', 'd': 'daughter', 'bro': 'brother', 'sis': 'sister'}

# Step 2: Greetings for each group of relatives
ELDER = 'Say: "身体健康, 长命百岁!" (shēn tǐ jiàn kāng, cháng mìng bǎi suì: good health and long life)'
ADULT = 'Say: "恭喜发财, 万事如意!" (gōng xǐ fā cái, wàn shì rú yì)'
PEER = 'Say: "新年快乐!" (xīn nián kuài lè). For working cousins add "步步高升!" (bù bù gāo shēng)'
KID = 'Kids are called by name. Say: "新年快乐, 学业进步!" (xué yè jìn bù: do well in school)'

# Step 3: Title table -> [Mandarin, Hokkien, Cantonese, greeting]
T = {
    'f': ['Uncle / 叔叔 (shū shu). Your partner calls him 爸爸, but you say Uncle for now!', 'Uncle', 'Uncle', ADULT],
    'm': ['Aunty / 阿姨 (ā yí). Your partner calls her 妈妈, but you say Aunty for now!', 'Aunty', 'Aunty', ADULT],
    'f,f': ['爷爷 (yé ye)', 'Ah Kong', 'Yeh Yeh', ELDER],
    'f,m': ['奶奶 (nǎi nai)', 'Ah Ma', 'Mah Mah', ELDER],
    'm,f': ['外公 (wài gōng)', 'Gua Kong', 'Gong Gong', ELDER],
    'm,m': ['外婆 (wài pó)', 'Gua Ma', 'Por Por', ELDER],
    'f,ob': ['伯伯 (bó bo)', 'Ah Pek', 'Ah Pak', ADULT],
    'f,ob,w': ['伯母 (bó mǔ)', 'Ah Mm', 'Pak Neung', ADULT],
    'f,yb': ['叔叔 (shū shu)', 'Ah Chek', 'Ah Suk', ADULT],
    'f,yb,w': ['婶婶 (shěn shen)', 'Ah Sim', 'Ah Sum', ADULT],
    'f,sis': ['姑姑 (gū gu)', 'Ah Koh', 'Gu Ma / Gu Jeh', ADULT],
    'f,sis,h': ['姑丈 (gū zhàng)', 'Koh Tio', 'Gu Jeung', ADULT],
    'm,bro': ['舅舅 (jiù jiu)', 'Ah Ku', 'Kau Fu', ADULT],
    'm,bro,w': ['舅妈 (jiù mā)', 'Ah Kim', 'Kam Mo', ADULT],
    'm,sis': ['阿姨 (ā yí)', 'Ah Ee', 'Ah Yi', ADULT],
    'm,sis,h': ['姨丈 (yí zhàng)', 'Ee Tio', 'Yi Jeung', ADULT],
    'ob': ['哥哥 (gē ge)', 'Ah Hia', 'Gor Gor', PEER],
    'os': ['姐姐 (jiě jie)', 'Ah Chi', 'Je Je', PEER],
    'yb': ['Call him by name (he is 弟弟 dì di to your partner)', 'by name', 'by name', PEER],
    'ys': ['Call her by name (she is 妹妹 mèi mei to your partner)', 'by name', 'by name', PEER],
    'bro': ['哥哥 (gē ge) if older than your partner, otherwise by name', 'Ah Hia / by name', 'Gor Gor / by name', PEER],
    'sis': ['姐姐 (jiě jie) if older than your partner, otherwise by name', 'Ah Chi / by name', 'Je Je / by name', PEER],
    'bro,w': ['嫂嫂 (sǎo sao) if her husband is older than your partner, otherwise by name', 'Ah So / by name', 'Ah Sou / by name', PEER],
    'sis,h': ['姐夫 (jiě fu) if his wife is older than your partner, otherwise by name', 'Chi Hu / by name', 'Je Fu / by name', PEER],
    'ob,w': ['嫂嫂 (sǎo sao)', 'Ah So', 'Ah Sou', PEER],
    'os,h': ['姐夫 (jiě fu)', 'Chi Hu', 'Je Fu', PEER],
    'yb,w': ['Call her by name (she is 弟媳 dì xí to your partner)', 'by name', 'by name', PEER],
    'ys,h': ['Call him by name (he is 妹夫 mèi fu to your partner)', 'by name', 'by name', PEER],
    'f,bro,s': ['堂哥 (táng gē) if older than your partner, 堂弟 (táng dì) if younger', 'Ko Ko / by name', 'Gor Gor / by name', PEER],
    'f,bro,d': ['堂姐 (táng jiě) if older than your partner, 堂妹 (táng mèi) if younger', 'Ah Chi / by name', 'Je Je / by name', PEER],
    'f,sis,s': ['表哥 (biǎo gē) if older than your partner, 表弟 (biǎo dì) if younger', 'Ko Ko / by name', 'Biu Gor / by name', PEER],
    'f,sis,d': ['表姐 (biǎo jiě) if older than your partner, 表妹 (biǎo mèi) if younger', 'Ah Chi / by name', 'Biu Je / by name', PEER],
    'm,sib,s': ['表哥 (biǎo gē) if older than your partner, 表弟 (biǎo dì) if younger', 'Ko Ko / by name', 'Biu Gor / by name', PEER],
    'm,sib,d': ['表姐 (biǎo jiě) if older than your partner, 表妹 (biǎo mèi) if younger', 'Ah Chi / by name', 'Biu Je / by name', PEER],
    'GP,pek': ['伯公 (bó gōng)', 'Pek Kong', 'Pak Gung', ELDER],
    'GP,pek,w': ['伯婆 (bó pó)', 'Pek Poh', 'Pak Po', ELDER],
    'GP,chek': ['叔公 (shū gōng)', 'Chek Kong', 'Suk Gung', ELDER],
    'GP,chek,w': ['婶婆 (shěn pó)', 'Sim Poh', 'Sum Po', ELDER],
    'GP,koh': ['姑婆 (gū pó)', 'Koh Poh', 'Gu Po', ELDER],
    'GP,koh,h': ['姑丈公 (gū zhàng gōng)', 'Koh Tio Kong', 'Gu Jeung Gung', ELDER],
    'GP,ku': ['舅公 (jiù gōng)', 'Ku Kong', 'Kau Gung', ELDER],
    'GP,ku,w': ['妗婆 (jìn pó)', 'Kim Poh', 'Kam Po', ELDER],
    'GP,ee': ['姨婆 (yí pó)', 'Ee Poh', 'Yi Po', ELDER],
    'GP,ee,h': ['姨丈公 (yí zhàng gōng)', 'Ee Tio Kong', 'Yi Jeung Gung', ELDER],
    'GGP,m': ['太公 (tài gōng)', 'Ah Chor', 'Tai Gung', ELDER],
    'GGP,f': ['太婆 (tài pó)', 'Ah Chor', 'Tai Ma', ELDER],
    'sib,s': ["Your partner's nephew: call him by name", 'by name', 'by name', KID],
    'sib,d': ["Your partner's niece: call her by name", 'by name', 'by name', KID],
}

HINT = "\n\nPick another person to continue, or 'Start over' / 'Done' lor."
SIBS = ['ob', 'yb', 'os', 'ys']
PAR = ['f', 'm']
KIDS = ['s', 'd']
MALE = ['f', 'ob', 'yb', 'h', 's', 'bro']


# Step 4: Simplify loops: dad's wife = mum, sister's mum = mum, son's mum = partner (or you), etc.
def simplify(c):
    changed = True
    while changed:
        changed = False
        for i in range(len(c) - 1):
            a = c[i]
            b = c[i + 1]
            rep = None
            if a == 'f' and b == 'w':
                rep = ['m']
            elif a == 'm' and b == 'h':
                rep = ['f']
            elif (a in SIBS or a == 'bro' or a == 'sis') and b in PAR:
                rep = [b]
            elif (a == 'w' and b == 'h') or (a == 'h' and b == 'w'):
                rep = []
            elif a in KIDS and b in PAR:
                rep = []
            elif a in PAR and b in KIDS:
                rep = ['bro' if b == 's' else 'sis']
            if rep is not None:
                c[i:i + 2] = rep
                changed = True
                break
    return c


# Step 5: Turn a simplified chain into a key for the title table
def lookup_key(c):
    # great-grandparents
    if len(c) == 3 and all(x in PAR for x in c):
        return 'GGP,' + ('m' if c[2] == 'f' else 'f')

    # grandparents' siblings (and their spouses)
    if len(c) in (3, 4) and c[0] in PAR and c[1] in PAR and c[2] in SIBS:
        s = c[2]
        if c[1] == 'f':
            gp = 'pek' if s == 'ob' else ('chek' if s == 'yb' else 'koh')
        else:
            gp = 'ku' if s in ('ob', 'yb') else 'ee'
        return 'GP,' + gp + (',' + c[3] if len(c) == 4 else '')

    n = []
    for i, x in enumerate(c):
        if i == 1 and c[0] == 'f' and x in ('os', 'ys'):
            x = 'sis'
        elif i == 1 and c[0] == 'f' and x in ('ob', 'yb') and len(c) == 3 and c[2] in KIDS:
            x = 'bro'
        elif i == 1 and c[0] == 'm' and x in ('ob', 'yb'):
            x = 'sib' if (len(c) == 3 and c[2] in KIDS) else 'bro'
        elif i == 1 and c[0] == 'm' and x in ('os', 'ys'):
            x = 'sib' if (len(c) == 3 and c[2] in KIDS) else 'sis'
        elif i == 0 and (x in SIBS or x in ('bro', 'sis')) and len(c) == 2 and c[1] in KIDS:
            x = 'sib'
        n.append(x)
    return ','.join(n)


# Step 6: Works out a safe answer for anyone not in the table
def figure_out(c):
    male = c[-1] in MALE
    gen = 0
    for x in c:
        if x in PAR:
            gen += 1
        if x in KIDS:
            gen -= 1

    # married-in link before the last person = not blood family
    sp = -1
    for i, x in enumerate(c[:-1]):
        if x in ('h', 'w'):
            sp = i
            break

    if gen >= 3:
        a = ['太公 (tài gōng)', 'Ah Chor', 'Tai Gung', ELDER] if male else ['太婆 (tài pó)', 'Ah Chor', 'Tai Ma', ELDER]
    elif gen == 2:
        a = ['公公 (gōng gong)', 'Ah Kong', 'Ah Gung', ELDER] if male else ['婆婆 (pó po)', 'Ah Ma', 'Ah Por', ELDER]
    elif gen == 1:
        a = (["Uncle / 叔叔 (shū shu), or 伯伯 (bó bo) if he looks older than your partner's dad", 'Uncle / Ah Pek', 'Uncle / Ah Suk', ADULT]
             if male else ['Aunty / 阿姨 (ā yí)', 'Aunty / Ah Ee', 'Aunty / Ah Yi', ADULT])
    elif gen == 0:
        a = (['哥哥 (gē ge) if he is older than you, otherwise by name', 'Ko Ko / by name', 'Gor Gor / by name', PEER]
             if male else ['姐姐 (jiě jie) if she is older than you, otherwise by name', 'Ah Chi / by name', 'Je Je / by name', PEER])
    else:
        a = ['Call ' + ('him' if male else 'her') + ' by name', 'by name', 'by name', KID]

    if sp >= 0:
        owner = "your partner's " + "'s ".join(NAME[x] for x in c[:sp + 1])
        intro = 'Not blood family lah, ' + ('he' if male else 'she') + ' is from ' + owner + "'s side."
        if sp == len(c) - 2 and c[-1] in PAR:
            intro += ' The family calls ' + ('him' if male else 'her') + ' 亲家 (qìng jia), the in-law side.'
        intro += ' Just go by age, Aunty suggests:'
    else:
        intro = 'Got a proper title for this one, but even Aunty must count fingers! Most families just go by age:'
    return intro, a


# Step 7: Main function - same job as the Botpress card.
# state is a dict with 'chain' (e.g. 'f,ob') and 'calcDone' ('yes' / 'no')
def new_state():
    return {'chain': '', 'calcDone': 'no'}


def relative_calculator(pick, state):
    pick = str(pick or '').strip()
    state['calcDone'] = 'no'

    if re.search(r'start over', pick, re.I):
        state['chain'] = ''
        return 'Okay, start again lah! Who is it to your partner? Pick the first person.'

    if re.search(r'done', pick, re.I):
        state['chain'] = ''
        state['calcDone'] = 'yes'
        return 'Steady! Remember hor, greet the eldest first and pass the oranges with two hands. Ask Aunty anything else. Huat ah!'

    if not state['chain'] and pick in ['Husband', 'Wife', 'Son', 'Daughter']:
        return "Eh, start with your partner's parent or sibling first lah, like Dad, Mum or Older sister."

    if pick not in MAP:
        return 'Aiyoh, Aunty catch no ball leh. Pick one from the list can?'

    chain = (state['chain'].split(',') if state['chain'] else []) + [MAP[pick]]
    state['chain'] = ','.join(chain)
    path = "Your partner's " + "'s ".join(NAME[x] for x in chain)
    c = simplify(chain.copy())

    if len(chain) > 8:
        state['chain'] = ''
        return (path + ': Wah, so long the chain, Aunty also pening already! Let\'s start over. '
                'For anyone that far, a warm "Uncle" or "Aunty" is always safe lah.' + HINT)
    if len(c) == 0:
        return path + ': Eh, that one is your partner (or you) leh! 😄' + HINT
    if len(c) == 1 and c[0] in ('h', 'w'):
        return path + ': Haha, that one is you lah!' + HINT

    same = ''
    if ','.join(c) != ','.join(chain):
        same = " (that's your partner's " + "'s ".join(NAME[x] for x in c) + ')'

    r = T.get(lookup_key(c))
    if r:
        return (path + same + ':\n• Mandarin: ' + r[0] + '\n• Hokkien: ' + r[1]
                + '\n• Cantonese: ' + r[2] + '\n' + r[3] + HINT)

    intro, a = figure_out(c)
    return (path + same + ': ' + intro + '\n• Mandarin: ' + a[0] + '\n• Hokkien: ' + a[1]
            + '\n• Cantonese: ' + a[2] + '\n' + a[3]
            + "\nWant it exact? The Meet-the-Parents Kit's personalised cheat sheet is checked by hand." + HINT)


# Quick test when you run this file on its own (F5 in Spyder)
if __name__ == '__main__':
    state = new_state()
    for p in ['Dad', 'Older brother', 'Wife']:
        print('>>', p)
        print(relative_calculator(p, state))
        print()
