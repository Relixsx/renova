#!/usr/bin/env python3
"""Build Renova's local settlement/ward lookup from the public GRID3 CSV."""
import argparse
import csv
import gzip
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

SOURCE = (
    "https://data.grid3.org/api/download/v1/items/"
    "73d8522d1c4d4c75be6c10fa790c685c/csv?layers=0"
)

# GRID3 and the checkout catalogue use different spellings for these LGAs.
LGA_SPELLINGS = {
    "AB": {"obi nwga": "Obi Ngwa", "osisioma ngwa": "Osisioma"},
    "AD": {"fufore": "Fufure", "girei": "Grie", "guyuk": "Gayuk"},
    "BA": {"dambam": "Damban"},
    "BY": {"yenegoa": "Yenagoa"},
    "CR": {"yakurr": "Yakuur"},
    "ED": {"iguegben": "Igueben"},
    "GO": {"shomgom": "Shongom"},
    "IM": {"mbatoli": "Mbaitoli", "onuimo": "Unuimo"},
    "KN": {"garun malam": "Garun Mallam", "nassarawa": "Nasarawa"},
    "KE": {"bagudu": "Bagudo"},
    "LA": {"ifako ijaye": "Ifako-Ijaiye"},
    "NI": {"munya": "Moya"},
    "OG": {"yewa north": "Egbado North", "yewa south": "Egbado South"},
    "OS": {
        "atakunmosa east": "Atakumosa East", "atakunmosa west": "Atakumosa West",
        "ayedade": "Aiyedaade", "ayedire": "Aiyedire",
        "ilesha east": "Ilesa East", "ilesha west": "Ilesa West",
    },
    "OY": {"oyo west": "Oyo"},
    "RI": {"omumma": "Omuma"},
    "SO": {"wamakko": "Wamako"},
    "TA": {"kurmi": "Kumi"},
    "ZA": {"tsafe": "Chafe"},
}


def normalize(value):
    lower = unicodedata.normalize("NFKD", value).lower()
    return " ".join(re.findall(r"[a-z0-9]+", "".join(
        ch for ch in lower if not unicodedata.combining(ch)
    )))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("grid3_csv", type=Path, help=f"Public download: {SOURCE}")
    parser.add_argument("catalogue_json", type=Path, help="Renova ng-geo-data state/LGA catalogue")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    catalogue = json.loads(args.catalogue_json.read_text())
    states = {normalize(s["name"]): s["code"] for s in catalogue}
    lgas = {s["code"]: {normalize(l["name"]): l["name"] for l in s["lgas"]} for s in catalogue}
    places = {s: defaultdict(set) for s in lgas}
    seen_lgas = {s: set() for s in lgas}
    source_rows = 0
    with args.grid3_csv.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            source_rows += 1
            state = states[normalize(row["statename"])]
            raw_lga = normalize(row["lganame"])
            lga = LGA_SPELLINGS.get(state, {}).get(raw_lga, lgas[state].get(raw_lga))
            if lga not in lgas[state].values():
                raise ValueError(f"{state}: unrecognised GRID3 LGA {row['lganame']!r}")
            seen_lgas[state].add(lga)
            for value in (row["set_name"], row["wardname"], row["set_altnam"]):
                name = normalize(value)
                if 3 <= len(name) <= 90 and len(name.split()) <= 10 and re.search(r"[a-z]", name):
                    places[state][name].add(lga)

    if source_rows < 290_000 or any(seen_lgas[s] != set(lgas[s].values()) for s in lgas):
        raise ValueError("Expected observations for all 774 LGAs in the nationwide source")
    index = {}
    for s, names in sorted(places.items()):
        names_of_lgas = sorted(seen_lgas[s])
        ids = {lga: i for i, lga in enumerate(names_of_lgas)}
        index[s] = [names_of_lgas, {
            name: ids[next(iter(areas))] if len(areas) == 1 else sorted(ids[a] for a in areas)
            for name, areas in sorted(names.items())
        }]
    encoded = json.dumps(index, ensure_ascii=False, separators=(",", ":")).encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
    print(f"{source_rows:,} GRID3 points → {sum(map(len, places.values())):,} place names", file=sys.stderr)


if __name__ == "__main__":
    main()
