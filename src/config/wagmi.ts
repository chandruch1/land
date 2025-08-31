import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'LandShare Protocol',
  projectId: 'landshare-dapp',
  chains: [sepolia],
  ssr: false,
});

export const ADMIN_WALLET = '0xC87dAE04cC23b8C078acE5E30F5B2575535a50B0';

export const CONTRACTS = {
  FRACTIONALIZATION: '0x7eFd92FAB22CAD2a2EBaF5795D43e9eE1367dbf6',
  LAND_TOKEN: '0x2089cb616333462e0987105f137DD8Af2C190957',
} as const;

export const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

export const LAND_TOKEN = {
  address: '0x2089cb616333462e0987105f137DD8Af2C190957',
  symbol: 'LAND',
  decimals: 18,
} as const;