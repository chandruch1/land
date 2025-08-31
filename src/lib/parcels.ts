export interface TokenizedParcel {
  id: string;
  location: string;
  acres: number;
  units: number;
  remainingUnits: number;
  metadataURI: string;
  ipfsHash: string;
  createdAt: string;
}

const STORAGE_KEY = 'landshare_tokenized_parcels_v1';

export function getParcels(): TokenizedParcel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TokenizedParcel[];
    return [];
  } catch {
    return [];
  }
}

export function addParcel(parcel: TokenizedParcel): void {
  const list = getParcels();
  list.unshift(parcel);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function removeParcel(id: string): void {
  const list = getParcels().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function decrementParcelUnits(parcelId: string, unitsToBuy: number): TokenizedParcel | null {
  const list = getParcels();
  const idx = list.findIndex(p => p.id === parcelId);
  if (idx === -1) return null;
  const current = list[idx];
  const newRemaining = Math.max(0, (current.remainingUnits ?? current.units) - unitsToBuy);
  const updated: TokenizedParcel = { ...current, remainingUnits: newRemaining };
  list[idx] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return updated;
}


