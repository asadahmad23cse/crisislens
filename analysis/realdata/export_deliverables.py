"""Export aggregate evidence only. Never publish tweet text or identifiers."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'analysis/output/realdata'


def main():
    phase1 = json.loads((OUT / 'phase1_results.json').read_text(encoding='utf-8'))
    selected = [r for r in phase1['metrics'] if
                (r['domain'] == 'real' and r['target'] == 'restricted' and r['event'] in
                 ('hurricane_maria_2017', 'kerala_floods_2018')) or r['domain'] == 'simulated']
    result = {'phase1': {'rows': selected, 'posts': phase1['audit']['raw_rows'],
                         'limitations': phase1['limitations'], 'transformer': phase1['transformer']}}
    for key, name in [('evidence', 'phase2_results.json'), ('uncertainty', 'phase4_results.json'),
                      ('silence', 'phase3_results.json')]:
        if (OUT / name).exists():
            result[key] = json.loads((OUT / name).read_text(encoding='utf-8'))
    destination = ROOT / 'src/lib/crisislens/data/realdata.json'
    destination.write_text(json.dumps(result, indent=2), encoding='utf-8')
    # The slide (presentation/project/slides/realdata.html) is hand-written in the deck's
    # format and published separately; this exporter does not overwrite it.
    print('Exported public aggregate data for the dashboard')


if __name__ == '__main__':
    main()
