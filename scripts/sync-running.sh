#!/usr/bin/env bash
set -euo pipefail
site_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$site_root/apps/running"
: "${KEEP_MOBILE:?KEEP_MOBILE is required}"
: "${KEEP_PASSWORD:?KEEP_PASSWORD is required}"
python run_page/keep_sync.py "$KEEP_MOBILE" "$KEEP_PASSWORD" --with-gpx

# Make svg GitHub profile
python run_page/gen_svg.py --from-db --title "$TITLE" --type github --github-style "align-firstday" --athlete "$ATHLETE" --special-distance 10 --special-distance2 20 --special-color yellow --special-color2 red --output assets/github.svg --use-localtime --min-distance 0.5
python run_page/gen_svg.py --from-db --title "$TITLE_GRID" --type grid --athlete "$ATHLETE" --output assets/grid.svg --special-color yellow --special-color2 red --special-distance 20 --special-distance2 40 --use-localtime --min-distance "$MIN_GRID_DISTANCE"
python run_page/gen_svg.py --from-db --type circular --use-localtime
python run_page/gen_svg.py --from-db --year $(date +"%Y")  --language zh_CN --title "$(date +"%Y") Running" --type github --github-style "align-firstday" --athlete "$ATHLETE" --special-distance 10 --special-distance2 20 --special-color yellow --special-color2 red --output assets/github_$(date +"%Y").svg --use-localtime --min-distance 0.5

# Make month of life
python run_page/gen_svg.py --from-db --type monthoflife --birth "$BIRTHDAY_MONTH" --special-color "#f9d367"  --special-color2 "#f0a1a8" --output assets/mol_running.svg --use-localtime --athlete "$ATHLETE" --title "Runner Month of Life" --sport-type running
python run_page/gen_svg.py --from-db --type monthoflife --birth "$BIRTHDAY_MONTH" --special-color "#f9d367"  --special-color2 "#f0a1a8" --output assets/mol_walking.svg --use-localtime --athlete "$ATHLETE" --title "Walker Month of Life" --sport-type walking
python run_page/gen_svg.py --from-db --type monthoflife --birth "$BIRTHDAY_MONTH" --special-color "#f9d367"  --special-color2 "#f0a1a8" --output assets/mol_hiking.svg --use-localtime --athlete "$ATHLETE" --title "Hiker Month of Life" --sport-type hiking
python run_page/gen_svg.py --from-db --type monthoflife --birth "$BIRTHDAY_MONTH" --special-color "#f9d367"  --special-color2 "#f0a1a8" --output assets/mol_cycling.svg --use-localtime --athlete "$ATHLETE" --title "Cyclist Month of Life" --sport-type cycling
python run_page/gen_svg.py --from-db --type monthoflife --birth "$BIRTHDAY_MONTH" --special-color "#f9d367"  --special-color2 "#f0a1a8" --output assets/mol.svg --use-localtime --athlete "$ATHLETE" --title "Month of Life" --sport-type all
python run_page/gen_svg.py --from-db --type monthoflife --birth "$BIRTHDAY_MONTH" --special-color "#f9d367"  --special-color2 "#f0a1a8" --output assets/mol_swimming.svg --use-localtime --athlete "$ATHLETE" --title "Swimmer Month of Life" --sport-type swimming
python run_page/gen_svg.py --from-db --type monthoflife --birth "$BIRTHDAY_MONTH" --special-color "#f9d367"  --special-color2 "#f0a1a8" --output assets/mol_skiing.svg --use-localtime --athlete "$ATHLETE" --title "Skier Month of Life" --sport-type skiing

# Make year summary
python run_page/gen_svg.py --from-db --type year_summary --output assets/year_summary.svg --athlete "$ATHLETE"

bash "$site_root/scripts/save-running-data.sh"
