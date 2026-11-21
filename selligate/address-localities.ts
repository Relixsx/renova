import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { getAllStates } from 'ng-geo-data';
import { canonicalLga, SELLIGATE_AREAS } from './delivery-areas';

type StateIndex = [lgas: string[], names: Record<string, number | number[]>];
type AddressMatch =
  | { lga: string }
  | { reason: 'AMBIGUOUS_DELIVERY_LGA' | 'CONFLICTING_DELIVERY_STATE' }
  | null;

const normalize = (text: string) => text.normalize('NFKD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const states = getAllStates();
const stateNames = new Map(states.map(s => [normalize(s.name), s.code]));
stateNames.set('federal capital territory', 'FC');
stateNames.set('abuja', 'FC');

let index: Record<string, StateIndex> | null | undefined;
function stateIndex(state: string): StateIndex | undefined {
  if (index === undefined) {
    try {
      index = JSON.parse(gunzipSync(readFileSync(join(process.cwd(), 'selligate/data/grid3-address-index.json.gz'))).toString('utf8'));
    } catch {
      // A missing or unreadable index must never turn a guess into a dispatch.
      console.warn('Selligate address lookup data unavailable.');
      index = null;
    }
  }
  return index && Object.hasOwn(index, state) ? index[state] : undefined;
}

const roadWords = /\b(?:street|st|road|rd|avenue|ave|crescent|cr|close|cl|lane|ln|highway|expressway|drive|dr|boulevard|way)\b/g;
const directions = /\b(?:opposite|opp|beside|behind|near|after|before|towards|via|off|along)\b/;
const generic = /^(?:[a-z]{1,2}|\d+|(?:ward|phase|zone|area|sector|block|gate|estate|village|market|junction|new site|primary school)(?: [a-z0-9]{1,2})?)$/;
const broadNames: Readonly<Record<string, readonly string[]>> = {
  LA: ['lekki', 'lekki city'],
  RI: ['port harcourt city', 'greater port harcourt'],
  FC: ['fct abuja', 'abuja fct', 'abuja city'],
  KD: ['kaduna city', 'kaduna metropolis'],
};

function geographicEnd(key: string) {
  return key.replace(/(?:^| )(?:federal republic of )?nigeria$/, '').trim()
    .replace(/(?:^| )(?:ng )?\d{6}$/, '').trim();
}

function withoutBroadEnd(key: string, broad: readonly string[]) {
  let value = geographicEnd(key);
  // Common address layout: "<neighbourhood> <city> <state>", with no commas.
  for (let i = 0; i < 4 && value; i++) {
    const suffix = broad.find(name => value === name || value.endsWith(' ' + name));
    if (!suffix) break;
    value = value.slice(0, -(suffix.length)).trimEnd();
  }
  return value;
}

function explicitAddressState(parts: readonly string[], selected: string) {
  for (const part of [...parts].reverse()) {
    const key = geographicEnd(normalize(part));
    if (!key) continue;
    // "Nasarawa", for example, can be a locality in Kano as well as a state.
    const exact = !canonicalLga(selected, key) ? stateNames.get(key) : undefined;
    if (exact) return exact;
    for (const [name, code] of stateNames) {
      if (key === name + ' state' || key.endsWith(' ' + name + ' state')) return code;
    }
    break;
  }
}

function localityCandidates(state: string, part: string, broad: readonly string[], data: StateIndex): Set<string> | undefined {
  let key = withoutBroadEnd(normalize(part), broad);
  if (!key || /^\d{5,}(?: |$)/.test(key)) return;
  // Only use a place after the roadway label, never a place in the road name.
  // For example, "Yaba Road" by itself does not place the customer in Yaba.
  const road = Array.from(key.matchAll(roadWords)).at(-1);
  if (road?.index != null) key = key.slice(road.index + road[0].length).trim();
  if (!key || directions.test(key) || generic.test(key)) return;

  const [lgas, names] = data;
  const labels = [key];
  // Support the ordinary Ungwan/Unguwan/Unguwar spelling variation without
  // accepting a single spelling when the variants point to other LGAs.
  const ward = key.match(/^(?:ungwan|unguwan|unguwar|ungwar) (.+)$/);
  if (ward) labels.push(...['ungwan', 'unguwan', 'unguwar', 'ungwar'].map(p => p + ' ' + ward[1]));
  // Digit and Roman-number forms for numbered neighbourhoods/wards.
  for (const [arabic, roman] of [['1', 'i'], ['2', 'ii'], ['3', 'iii'], ['4', 'iv']]) {
    if (key.endsWith(' ' + arabic)) labels.push(key.slice(0, -arabic.length) + roman);
    if (key.endsWith(' ' + roman)) labels.push(key.slice(0, -roman.length) + arabic);
  }
  const matches = new Set<string>();
  const direct = canonicalLga(state, key);
  if (direct) matches.add(direct);
  for (const label of labels) {
    if (!Object.hasOwn(names, label)) continue;
    const hit = names[label];
    for (const id of Array.isArray(hit) ? hit : [hit]) {
      if (typeof lgas[id] === 'string') matches.add(lgas[id]);
    }
  }
  return matches.size ? matches : undefined;
}

// Searches place names in the customer's address against a public dataset held
// on this server. No order or address is sent to an outside service.
export function inferAddressLga(state: string, address: Record<string, unknown>): AddressMatch {
  const streets = [address.streetAddress, address.address]
    .filter((v): v is string => typeof v === 'string' && v.length <= 1000)
    .map(v => v.split(/[,;\n]/u));
  for (const parts of streets) {
    const writtenState = explicitAddressState(parts, state);
    if (writtenState && writtenState !== state) return { reason: 'CONFLICTING_DELIVERY_STATE' };
  }
  const data = stateIndex(state);
  if (!data) return null;
  const stateInfo = states.find(s => s.code === state);
  if (!stateInfo) return null;
  const broad = [...new Set([
    normalize(stateInfo.name), normalize(stateInfo.name) + ' state',
    ...(SELLIGATE_AREAS[state]?.hubs ?? []).map(normalize), ...(broadNames[state] ?? []),
    ...(state === 'FC' ? ['federal capital territory'] : []),
  ])].sort((a, b) => b.length - a.length);
  const parts = [...streets.flat(), address.cityTown, address.town, address.city];
  let matching: Set<string> | undefined;
  for (const part of parts) {
    if (typeof part !== 'string' || !part.trim() || part.length > 1000) continue;
    const inferred = localityCandidates(state, part, broad, data);
    if (!inferred) continue;
    matching = matching ? new Set([...matching].filter(lga => inferred.has(lga))) : inferred;
  }
  if (!matching) return null;
  if (matching.size !== 1) return { reason: 'AMBIGUOUS_DELIVERY_LGA' };
  return { lga: [...matching][0] };
}
