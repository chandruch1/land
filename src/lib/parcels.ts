import { pinJsonToIPFS } from '@/config/pinata';

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
const MASTER_PARCELS_IPFS_KEY = 'landshare_master_parcels_index';

// Cache for performance
let parcelsCache: TokenizedParcel[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

async function getMasterParcelsHash(): Promise<string | null> {
  try {
    const jwt = import.meta.env.VITE_PINATA_JWT as string;
    if (!jwt) return null;

    const res = await fetch('https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=1000', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const rows: any[] = json.rows ?? [];
    const match = rows.find((row) =>
      row?.metadata?.name === MASTER_PARCELS_IPFS_KEY
    );
    return match?.ipfs_pin_hash ?? null;
  } catch {
    return null;
  }
}

async function fetchParcelsFromIPFS(): Promise<TokenizedParcel[]> {
  try {
    const masterHash = await getMasterParcelsHash();
    if (!masterHash) return [];

    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${masterHash}`);
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data as TokenizedParcel[] : [];
  } catch {
    return [];
  }
}

async function saveParcelsToIPFS(parcels: TokenizedParcel[]): Promise<void> {
  try {
    await pinJsonToIPFS(parcels, {
      name: MASTER_PARCELS_IPFS_KEY,
      keyvalues: {
        type: 'master_parcels_index',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to save parcels to IPFS:', error);
  }
}

export async function getParcels(): Promise<TokenizedParcel[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (parcelsCache && (now - lastFetchTime) < CACHE_DURATION) {
    return parcelsCache;
  }

  try {
    // Try to fetch from IPFS first
    const ipfsParcels = await fetchParcelsFromIPFS();
    if (ipfsParcels.length > 0) {
      parcelsCache = ipfsParcels;
      lastFetchTime = now;
      // Update localStorage as backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ipfsParcels));
      return ipfsParcels;
    }

    // Fallback to localStorage if IPFS fails
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      parcelsCache = [];
      lastFetchTime = now;
      return [];
    }
    
    const parsed = JSON.parse(raw);
    const localParcels = Array.isArray(parsed) ? parsed as TokenizedParcel[] : [];
    parcelsCache = localParcels;
    lastFetchTime = now;
    return localParcels;
  } catch {
    parcelsCache = [];
    lastFetchTime = now;
    return [];
  }
}

export async function addParcel(parcel: TokenizedParcel): Promise<void> {
  const list = await getParcels();
  list.unshift(parcel);
  
  // Update cache
  parcelsCache = list;
  lastFetchTime = Date.now();
  
  // Save to both IPFS and localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  await saveParcelsToIPFS(list);
}

export async function removeParcel(id: string): Promise<void> {
  const list = await getParcels();
  const filteredList = list.filter(p => p.id !== id);
  
  // Update cache
  parcelsCache = filteredList;
  lastFetchTime = Date.now();
  
  // Save to both IPFS and localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredList));
  await saveParcelsToIPFS(filteredList);
}

export async function decrementParcelUnits(parcelId: string, unitsToBuy: number): Promise<TokenizedParcel | null> {
  const list = await getParcels();
  const idx = list.findIndex(p => p.id === parcelId);
  if (idx === -1) return null;
  
  const current = list[idx];
  const newRemaining = Math.max(0, (current.remainingUnits ?? current.units) - unitsToBuy);
  const updated: TokenizedParcel = { ...current, remainingUnits: newRemaining };
  list[idx] = updated;
  
  // Update cache
  parcelsCache = list;
  lastFetchTime = Date.now();
  
  // Save to both IPFS and localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  await saveParcelsToIPFS(list);
  
  return updated;
}

// Synchronous version for backward compatibility
export function getParcelsSync(): TokenizedParcel[] {
  if (parcelsCache) return parcelsCache;
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as TokenizedParcel[] : [];
  } catch {
    return [];
  }
}

// Force refresh from IPFS
export async function refreshParcelsFromIPFS(): Promise<TokenizedParcel[]> {
  parcelsCache = null;
  lastFetchTime = 0;
  return await getParcels();
}
