import { getAllStates } from "ng-geo-data";

export type AnagenState = { name: string; code: string };
export const anagenStates: AnagenState[] = getAllStates().map(({ name, code }) => ({ name, code }));
