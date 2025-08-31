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

export function getTrades(): TradeRecord[] {
  try {
    const raw = localStorage.getItem(TRADES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TradeRecord[]) : [];
  } catch {
    return [];
  }
}

export function addTrade(trade: TradeRecord): void {
  const list = getTrades();
  list.unshift(trade);
  localStorage.setItem(TRADES_KEY, JSON.stringify(list));
}

export function getUserTrades(address: string): TradeRecord[] {
  const lower = address?.toLowerCase();
  return getTrades().filter(t => t.buyer.toLowerCase() === lower || t.seller.toLowerCase() === lower);
}

export function getPrices(): Record<string, { currentPrice: number; lastUpdated: string }>{
  try {
    const raw = localStorage.getItem(PRICES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function setPrice(parcelId: string, price: number): void {
  const map = getPrices();
  map[parcelId] = { currentPrice: price, lastUpdated: new Date().toISOString() };
  localStorage.setItem(PRICES_KEY, JSON.stringify(map));
}

export function getPriceOrDefault(parcelId: string, fallback = 50): number {
  const map = getPrices();
  return map[parcelId]?.currentPrice ?? fallback;
}

export function updateOrderUnits(orderId: string, unitsToRemove: number): void {
  const list = getTrades();
  const orderIndex = list.findIndex(t => t.id === orderId);
  if (orderIndex !== -1) {
    list[orderIndex].units -= unitsToRemove;
    if (list[orderIndex].units <= 0) {
      // Remove order if no units left
      list.splice(orderIndex, 1);
    }
    localStorage.setItem(TRADES_KEY, JSON.stringify(list));
  }
}

export function removeOrder(orderId: string): void {
  const list = getTrades();
  const orderIndex = list.findIndex(t => t.id === orderId);
  if (orderIndex !== -1) {
    list.splice(orderIndex, 1);
    localStorage.setItem(TRADES_KEY, JSON.stringify(list));
  }
}