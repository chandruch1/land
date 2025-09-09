import { pinJsonToIPFS } from '@/config/pinata';

export interface TradeRecord {
  id: string;
  parcelId: string;
  buyer: string;
  seller: string;
  units: number;
  pricePerUnit: number; // in LAND units
  total: number; // units * pricePerUnit
  side: 'buy' | 'sell';
  txHash: string;
  timestamp: string;
}

const TRADES_KEY = 'landshare_trades_v1';
const PRICES_KEY = 'landshare_prices_v1';
const MASTER_TRADES_IPFS_KEY = 'landshare_master_trades_index';
const MASTER_PRICES_IPFS_KEY = 'landshare_master_prices_index';

// Cache for performance
let tradesCache: TradeRecord[] | null = null;
let pricesCache: Record<string, { currentPrice: number; lastUpdated: string }> | null = null;
let lastTradesFetchTime = 0;
let lastPricesFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

async function getMasterHash(type: 'trades' | 'prices'): Promise<string | null> {
  try {
    const jwt = import.meta.env.VITE_PINATA_JWT as string;
    if (!jwt) return null;

    const keyName = type === 'trades' ? MASTER_TRADES_IPFS_KEY : MASTER_PRICES_IPFS_KEY;

    const res = await fetch('https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=1000', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const rows: any[] = json.rows ?? [];
    const match = rows.find((row) =>
      row?.metadata?.name === keyName
    );
    return match?.ipfs_pin_hash ?? null;
  } catch {
    return null;
  }
}

async function fetchTradesFromIPFS(): Promise<TradeRecord[]> {
  try {
    const masterHash = await getMasterHash('trades');
    if (!masterHash) return [];

    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${masterHash}`);
    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data as TradeRecord[] : [];
  } catch {
    return [];
  }
}

async function fetchPricesFromIPFS(): Promise<Record<string, { currentPrice: number; lastUpdated: string }>> {
  try {
    const masterHash = await getMasterHash('prices');
    if (!masterHash) return {};

    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${masterHash}`);
    if (!response.ok) return {};

    const data = await response.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

async function saveTradesToIPFS(trades: TradeRecord[]): Promise<void> {
  try {
    await pinJsonToIPFS(trades, {
      name: MASTER_TRADES_IPFS_KEY,
      keyvalues: {
        type: 'master_trades_index',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to save trades to IPFS:', error);
  }
}

async function savePricesToIPFS(prices: Record<string, { currentPrice: number; lastUpdated: string }>): Promise<void> {
  try {
    await pinJsonToIPFS(prices, {
      name: MASTER_PRICES_IPFS_KEY,
      keyvalues: {
        type: 'master_prices_index',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to save prices to IPFS:', error);
  }
}

export async function getTrades(): Promise<TradeRecord[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (tradesCache && (now - lastTradesFetchTime) < CACHE_DURATION) {
    return tradesCache;
  }

  try {
    // Try to fetch from IPFS first
    const ipfsTrades = await fetchTradesFromIPFS();
    if (ipfsTrades.length > 0) {
      tradesCache = ipfsTrades;
      lastTradesFetchTime = now;
      // Update localStorage as backup
      localStorage.setItem(TRADES_KEY, JSON.stringify(ipfsTrades));
      return ipfsTrades;
    }

    // Fallback to localStorage if IPFS fails
    const raw = localStorage.getItem(TRADES_KEY);
    if (!raw) {
      tradesCache = [];
      lastTradesFetchTime = now;
      return [];
    }
    
    const parsed = JSON.parse(raw);
    const localTrades = Array.isArray(parsed) ? parsed as TradeRecord[] : [];
    tradesCache = localTrades;
    lastTradesFetchTime = now;
    return localTrades;
  } catch {
    tradesCache = [];
    lastTradesFetchTime = now;
    return [];
  }
}

export async function addTrade(trade: TradeRecord): Promise<void> {
  const list = await getTrades();
  list.unshift(trade);
  
  // Update cache
  tradesCache = list;
  lastTradesFetchTime = Date.now();
  
  // Save to both IPFS and localStorage
  localStorage.setItem(TRADES_KEY, JSON.stringify(list));
  await saveTradesToIPFS(list);
}

export async function getUserTrades(address: string): Promise<TradeRecord[]> {
  const trades = await getTrades();
  const lower = address?.toLowerCase();
  return trades.filter(t => t.buyer.toLowerCase() === lower || t.seller.toLowerCase() === lower);
}

export async function getPrices(): Promise<Record<string, { currentPrice: number; lastUpdated: string }>> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (pricesCache && (now - lastPricesFetchTime) < CACHE_DURATION) {
    return pricesCache;
  }

  try {
    // Try to fetch from IPFS first
    const ipfsPrices = await fetchPricesFromIPFS();
    if (Object.keys(ipfsPrices).length > 0) {
      pricesCache = ipfsPrices;
      lastPricesFetchTime = now;
      // Update localStorage as backup
      localStorage.setItem(PRICES_KEY, JSON.stringify(ipfsPrices));
      return ipfsPrices;
    }

    // Fallback to localStorage if IPFS fails
    const raw = localStorage.getItem(PRICES_KEY);
    if (!raw) {
      pricesCache = {};
      lastPricesFetchTime = now;
      return {};
    }
    
    const parsed = JSON.parse(raw);
    const localPrices = parsed && typeof parsed === 'object' ? parsed : {};
    pricesCache = localPrices;
    lastPricesFetchTime = now;
    return localPrices;
  } catch {
    pricesCache = {};
    lastPricesFetchTime = now;
    return {};
  }
}

export async function setPrice(parcelId: string, price: number): Promise<void> {
  const map = await getPrices();
  map[parcelId] = { currentPrice: price, lastUpdated: new Date().toISOString() };
  
  // Update cache
  pricesCache = map;
  lastPricesFetchTime = Date.now();
  
  // Save to both IPFS and localStorage
  localStorage.setItem(PRICES_KEY, JSON.stringify(map));
  await savePricesToIPFS(map);
}

export async function getPriceOrDefault(parcelId: string, fallback = 50): Promise<number> {
  const map = await getPrices();
  return map[parcelId]?.currentPrice ?? fallback;
}

export async function updateOrderUnits(orderId: string, unitsToRemove: number): Promise<void> {
  const list = await getTrades();
  const orderIndex = list.findIndex(t => t.id === orderId);
  if (orderIndex !== -1) {
    list[orderIndex].units -= unitsToRemove;
    if (list[orderIndex].units <= 0) {
      // Remove order if no units left
      list.splice(orderIndex, 1);
    }
    
    // Update cache
    tradesCache = list;
    lastTradesFetchTime = Date.now();
    
    // Save to both IPFS and localStorage
    localStorage.setItem(TRADES_KEY, JSON.stringify(list));
    await saveTradesToIPFS(list);
  }
}

export async function removeOrder(orderId: string): Promise<void> {
  const list = await getTrades();
  const orderIndex = list.findIndex(t => t.id === orderId);
  if (orderIndex !== -1) {
    list.splice(orderIndex, 1);
    
    // Update cache
    tradesCache = list;
    lastTradesFetchTime = Date.now();
    
    // Save to both IPFS and localStorage
    localStorage.setItem(TRADES_KEY, JSON.stringify(list));
    await saveTradesToIPFS(list);
  }
}

// Synchronous versions for backward compatibility
export function getTradesSync(): TradeRecord[] {
  if (tradesCache) return tradesCache;
  
  try {
    const raw = localStorage.getItem(TRADES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as TradeRecord[] : [];
  } catch {
    return [];
  }
}

export function getPricesSync(): Record<string, { currentPrice: number; lastUpdated: string }> {
  if (pricesCache) return pricesCache;
  
  try {
    const raw = localStorage.getItem(PRICES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getPriceOrDefaultSync(parcelId: string, fallback = 50): number {
  const map = getPricesSync();
  return map[parcelId]?.currentPrice ?? fallback;
}

export function getUserTradesSync(address: string): TradeRecord[] {
  const trades = getTradesSync();
  const lower = address?.toLowerCase();
  return trades.filter(t => t.buyer.toLowerCase() === lower || t.seller.toLowerCase() === lower);
}

// Force refresh from IPFS
export async function refreshTradesFromIPFS(): Promise<TradeRecord[]> {
  tradesCache = null;
  lastTradesFetchTime = 0;
  return await getTrades();
}

export async function refreshPricesFromIPFS(): Promise<Record<string, { currentPrice: number; lastUpdated: string }>> {
  pricesCache = null;
  lastPricesFetchTime = 0;
  return await getPrices();
}