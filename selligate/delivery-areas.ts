import { getAllStates, getLGAsByState } from 'ng-geo-data';

type Scope = { hubs: string[]; lgas: string[] | null };
const local = (hubs: string[], ...lgas: string[]): Scope => ({ hubs, lgas });
const statewide = (name: string): Scope => ({ hubs: [name], lgas: null });

// Renova's automatic dispatch policy. This is not a provider stock or waybill list.
// A null LGA list means all identifiable LGAs in that state, as specified by the owner.
export const SELLIGATE_AREAS: Readonly<Record<string, Scope>> = {
  LA: local(['Lagos'], 'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Eti Osa', 'Ifako-Ijaiye', 'Ikeja', 'Kosofe', 'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere'),
  FC: local(['Abuja'], 'Municipal Area Council'),
  RI: local(['Port Harcourt'], 'Port Harcourt', 'Obio/Akpor'),
  KD: local(['Kaduna'], 'Kaduna North', 'Kaduna South'),
  KN: local(['Kano'], 'Dala', 'Fagge', 'Gwale', 'Kano Municipal', 'Kumbotso', 'Nasarawa', 'Tarauni', 'Ungogo'),
  AK: local(['Uyo', 'Eket'], 'Uyo', 'Eket'),
  CR: local(['Calabar'], 'Calabar Municipal', 'Calabar South'),
  OY: local(['Ibadan'], 'Ibadan North', 'Ibadan North-East', 'Ibadan North-West', 'Ibadan South-East', 'Ibadan South-West'),
  EK: local(['Ado Ekiti'], 'Ado Ekiti'),
  ON: local(['Akure'], 'Akure South'),
  AB: local(['Umuahia', 'Aba'], 'Umuahia North', 'Umuahia South', 'Aba North', 'Aba South'),
  SO: statewide('Sokoto'),
  OS: local(['Osogbo'], 'Osogbo', 'Olorunda'),
  BE: local(['Makurdi'], 'Makurdi'),
  AN: local(['Onitsha', 'Awka'], 'Onitsha North', 'Onitsha South', 'Awka South'),
  DE: local(['Warri', 'Ughelli', 'Asaba'], 'Warri South', 'Ughelli North', 'Oshimili South'),
  KW: local(['Ilorin'], 'Ilorin East', 'Ilorin South', 'Ilorin West'),
  KO: local(['Lokoja'], 'Lokoja'),
  ED: local(['Benin City'], 'Egor', 'Ikpoba Okha', 'Oredo'),
  EN: statewide('Enugu'),
  OG: local(['Abeokuta'], 'Abeokuta North', 'Abeokuta South'),
  IM: local(['Owerri'], 'Owerri Municipal'),
  EB: local(['Abakaliki'], 'Abakaliki'),
  NI: local(['Minna'], 'Chanchaga'),
  PL: local(['Jos'], 'Jos North', 'Jos South'),
  BY: statewide('Bayelsa'),
  NA: statewide('Nasarawa'),
  BA: statewide('Bauchi'),
  KT: statewide('Katsina'),
};

export const ROUTE_REASONS = {
  INVALID_DELIVERY_STATE: 'The delivery state is missing or invalid.',
  CONFLICTING_DELIVERY_STATE: 'The delivery address contains conflicting states.',
  SELLIGATE_STATE_NOT_COVERED: 'Selligate is not configured to dispatch in this state.',
  DELIVERY_LGA_REQUIRED: 'The delivery LGA could not be identified. Confirm it before manual fulfilment.',
  INVALID_DELIVERY_LGA: 'The selected LGA does not belong to this state or is not recognised.',
  CONFLICTING_DELIVERY_LGA: 'The delivery LGA and the address disagree.',
  SELLIGATE_LGA_NOT_COVERED: 'This LGA is outside Renova’s Selligate delivery area.',
  NO_AVAILABILITY_CONFIGURATION: 'This item has no Selligate stock locations configured.',
  UNAVAILABLE_IN_STATE: 'This item is unavailable in the selected state.',
  AVAILABLE_IN_COVERED_LGA: 'This item is available in the state and the delivery LGA is covered.',
} as const;

type BlockedReason = Exclude<keyof typeof ROUTE_REASONS, 'NO_AVAILABILITY_CONFIGURATION' | 'UNAVAILABLE_IN_STATE' | 'AVAILABLE_IN_COVERED_LGA'>;
export type DeliveryArea = { lga: string | null; reason: BlockedReason | null };

const normal = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stateNames = new Map(getAllStates().map(({code, name}) => [code, normal(name)]));
const lgaIndexes = new Map<string, Map<string, string>>();

// Official names come from the same location catalogue as checkout. These aliases
// handle common spellings and places whose LGA can be identified conservatively.
// Bare multi-LGA city names (Abuja, Ibadan, Onitsha, Warri, etc.) are not guesses.
const aliases: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  EK: { 'oye ekiti': 'Oye', 'ikere ekiti': 'Ikere', 'ikole ekiti': 'Ikole', 'ijero ekiti': 'Ijero', 'emure ekiti': 'Emure' },
  FC: { 'amac': 'Municipal Area Council', 'abuja municipal': 'Municipal Area Council', 'abuja municipal area council': 'Municipal Area Council', 'kubwa': 'Bwari' },
  RI: { 'port harcourt city': 'Port Harcourt' },
  KN: { 'nassarawa': 'Nasarawa', 'kano municipal council': 'Kano Municipal' },
  CR: { 'calabar municipality': 'Calabar Municipal' },
  DE: { 'asaba': 'Oshimili South', 'ughelli': 'Ughelli North', 'okpanam': 'Oshimili North' },
  IM: { 'owerri urban': 'Owerri Municipal' },
  OS: { 'oshogbo': 'Osogbo' },
};

function lgaIndex(state: string) {
  let index = lgaIndexes.get(state);
  if (!index) {
    index = new Map(getLGAsByState(state).map(({name}) => [normal(name), name]));
    lgaIndexes.set(state, index);
  }
  return index;
}

export function canonicalLga(state: string, value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 140) return null;
  const key = normal(value).replace(/ (?:l\s*g\s*a|local government(?: area)?)$/, '');
  const index = lgaIndex(state);
  const stateAliases = aliases[state];
  const alias = stateAliases && Object.hasOwn(stateAliases, key) ? stateAliases[key] : undefined;
  return index.get(key) ?? (alias ? index.get(normal(alias)) : undefined)
    ?? (state === 'FC' ? index.get(key.replace(/ area council$/, '')) : undefined) ?? null;
}

function localityHints(state: string, addr: Record<string, unknown>): string[] {
  const hits = new Set<string>();
  const stateName = stateNames.get(state);
  const townParts = [addr.cityTown, addr.town, addr.city];
  const streets = [addr.streetAddress, addr.address].filter((part): part is string => typeof part === 'string' && part.length <= 1000);
  const parts = [...townParts, ...streets.flatMap(part => part.split(/[,;\n]/u))];
  const preciseEndings = [...lgaIndex(state).keys(), ...Object.keys(aliases[state] ?? {})].filter(name => name.includes(' ') && name !== stateName);
  for (const part of parts) {
    if (typeof part !== 'string' || part.length > 1000) continue;
    const key = normal(part);
    if (!key || key === stateName || key === `${stateName} state`) continue;
    const match = canonicalLga(state, part);
    if (match) hits.add(match);
    // The Anagen form can leave its LGA field blank. A precise locality at the
    // end of the address can identify it; a word in a road name does not.
    let end = key.replace(/ nigeria$/, '').replace(/ \d{6}$/, '');
    const stateSuffix = ` ${stateName} state`;
    if (stateName && end.endsWith(stateSuffix)) end = end.slice(0, -stateSuffix.length);
    end = end.replace(/ (?:lga|local government(?: area)?)$/, '');
    for (const hint of preciseEndings) {
      if (end === hint || end.endsWith(` ${hint}`)) {
        const lga = canonicalLga(state, hint);
        if (lga) hits.add(lga);
      }
    }
  }
  return [...hits];
}

export function checkDeliveryArea(state: string | null, address: Record<string, unknown>, conflictingState = false): DeliveryArea {
  if (!state) return { lga: null, reason: 'INVALID_DELIVERY_STATE' };
  if (conflictingState) return { lga: null, reason: 'CONFLICTING_DELIVERY_STATE' };
  const scope = SELLIGATE_AREAS[state];
  if (!Object.hasOwn(SELLIGATE_AREAS, state) || !scope) return { lga: null, reason: 'SELLIGATE_STATE_NOT_COVERED' };

  const chosen: string[] = [];
  for (const field of [address.lga, address.localGovernment, address.localGovernmentArea]) {
    if (field == null || (typeof field === 'string' && !field.trim())) continue;
    const value = typeof field === 'object' ? (field as Record<string, unknown>).name : field;
    const lga = canonicalLga(state, value);
    if (!lga) return { lga: null, reason: 'INVALID_DELIVERY_LGA' };
    chosen.push(lga);
  }
  const candidates = [...new Set([...chosen, ...localityHints(state, address)])];
  if (!candidates.length) return { lga: null, reason: 'DELIVERY_LGA_REQUIRED' };
  if (candidates.length > 1) return { lga: chosen[0] ?? null, reason: 'CONFLICTING_DELIVERY_LGA' };
  const [lga] = candidates;
  if (scope.lgas && !scope.lgas.includes(lga)) return { lga, reason: 'SELLIGATE_LGA_NOT_COVERED' };
  return { lga, reason: null };
}

export function deliveryAreasForDashboard() {
  return Object.entries(SELLIGATE_AREAS).map(([stateCode, scope]) => ({ stateCode, hubs: scope.hubs, lgas: scope.lgas }));
}
