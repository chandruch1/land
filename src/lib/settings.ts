const FEE_KEY = 'landshare_platform_fee_v1';

export function getPlatformFee(): string {
  try {
    return localStorage.getItem(FEE_KEY) || '';
  } catch {
    return '';
  }
}

export function setPlatformFee(value: string): void {
  localStorage.setItem(FEE_KEY, value);
}
















