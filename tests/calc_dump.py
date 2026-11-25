# Prints the Python calculator's answer for every chain up to 4 picks (used by calculator.test.mjs)
import itertools, json, sys
sys.path.insert(0, sys.argv[1])
from calculator import new_state, relative_calculator
picks = ['Dad', 'Mum', 'Older brother', 'Younger brother', 'Older sister', 'Younger sister',
         'Husband', 'Wife', 'Daughter', 'Son']
out = {}
for n in range(1, 5):
    for combo in itertools.product(picks, repeat=n):
        st = new_state()
        out['>'.join(combo)] = [relative_calculator(p, st) for p in combo]
for seq in [['Dad'] * 9, ['Dad', 'Start over', 'Mum'], ['Mum', 'Done'], ['banana'], ['Dad', 'xyz', 'Wife']]:
    st = new_state()
    out['>'.join(seq)] = [relative_calculator(p, st) for p in seq] + [st['calcDone']]
print(json.dumps(out, ensure_ascii=False))
