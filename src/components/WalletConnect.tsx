import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/enhanced-button';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';

interface WalletConnectProps {
  onConnected?: (address: string) => void;
}

const WalletConnect = ({ onConnected }: WalletConnectProps) => {
  const { address, isConnected } = useAccount();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button 
                    variant="default" 
                    size="xl"
                    onClick={openConnectModal}
                    className="gap-3 bg-gray-900 text-white hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Wallet className="w-5 h-5" />
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button 
                    variant="destructive" 
                    size="lg"
                    onClick={openChainModal}
                  >
                    Wrong network
                  </Button>
                );
              }

              return (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={openChainModal}
                    className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          overflow: 'hidden',
                          marginRight: 4,
                        }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 12, height: 12 }}
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </Button>

                  <Button 
                    variant="default" 
                    size="lg"
                    onClick={openAccountModal}
                    className="bg-gray-900 text-white hover:bg-gray-800"
                  >
                    {account.displayName}
                    {account.displayBalance
                      ? ` (${account.displayBalance})`
                      : ''}
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default WalletConnect;