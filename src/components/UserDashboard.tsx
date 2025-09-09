import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount, useDisconnect, useReadContract, useWriteContract } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { LAND_TOKEN } from '@/config/wagmi';
import { formatUnits, parseUnits } from 'viem';
import { sepolia } from 'wagmi/chains';
import { Landmark, TrendingUp, DollarSign, Users, LogOut, Eye, ShoppingCart, RefreshCw, Plus, List, Clock, Hash } from 'lucide-react';
import { getParcels, getParcelsSync, type TokenizedParcel, decrementParcelUnits, refreshParcelsFromIPFS } from '@/lib/parcels';
import { getTrades, getTradesSync, getUserTrades, getUserTradesSync, addTrade, getPriceOrDefault, getPriceOrDefaultSync, getPrices, getPricesSync, updateOrderUnits, removeOrder, refreshTradesFromIPFS, refreshPricesFromIPFS } from '@/lib/trades';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const UserDashboard = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [parcels, setParcels] = useState<TokenizedParcel[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [buyForm, setBuyForm] = useState({
    parcelId: '',
    units: ''
  });
  const [listForSaleForm, setListForSaleForm] = useState({
    parcelId: '',
    units: '',
    pricePerUnit: ''
  });
  const [buyTokensForm, setBuyTokensForm] = useState({
    amount: ''
  });
  const [orderForms, setOrderForms] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<any>(null);
  const [pinataData, setPinataData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Get user's LAND token balance
  const { data: landBalance } = useReadContract({
    abi: [
      { "type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}] }
    ],
    address: LAND_TOKEN.address as `0x${string}`,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
  });

  // Load data from IPFS with fallback to localStorage
  const loadData = async () => {
    setIsLoadingData(true);
    try {
      // Load parcels from IPFS first, fallback to sync version
      const allParcels = await getParcels().catch(() => getParcelsSync());
      setParcels(allParcels);
      
      // Load prices from IPFS first, fallback to sync version
      const prices = await getPrices().catch(() => getPricesSync());
      const priceMap: Record<string, number> = {};
      Object.keys(prices).forEach(parcelId => {
        priceMap[parcelId] = prices[parcelId].currentPrice;
      });
      setCurrentPrices(priceMap);
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to sync versions
      setParcels(getParcelsSync());
      const prices = getPricesSync();
      const priceMap: Record<string, number> = {};
      Object.keys(prices).forEach(parcelId => {
        priceMap[parcelId] = prices[parcelId].currentPrice;
      });
      setCurrentPrices(priceMap);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Force refresh data from IPFS
  const refreshDataFromIPFS = async () => {
    setIsLoadingData(true);
    try {
      // Force refresh from IPFS
      const [refreshedParcels, refreshedPrices] = await Promise.all([
        refreshParcelsFromIPFS(),
        refreshPricesFromIPFS()
      ]);
      
      setParcels(refreshedParcels);
      
      const priceMap: Record<string, number> = {};
      Object.keys(refreshedPrices).forEach(parcelId => {
        priceMap[parcelId] = refreshedPrices[parcelId].currentPrice;
      });
      setCurrentPrices(priceMap);
      
      toast({
        title: "Data Refreshed",
        description: "Successfully synced latest data from IPFS",
      });
    } catch (error) {
      console.error('Error refreshing from IPFS:', error);
      toast({
        title: "Refresh Failed",
        description: "Could not sync from IPFS, using local data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Fetch Pinata data for user's address
  useEffect(() => {
    const fetchPinataData = async () => {
      if (!address) return;
      
      try {
        // Use async version with fallback to sync
        const userTrades = await getUserTrades(address).catch(() => getUserTradesSync(address));
        const userParcels = userTrades
          .filter(t => t.buyer.toLowerCase() === address.toLowerCase())
          .map(t => {
            const parcel = parcels.find(p => p.id === t.parcelId);
            return {
              ...parcel,
              tradeData: t,
              pinataUrl: parcel?.metadataURI || ''
            };
          });
        
        setPinataData(userParcels);
      } catch (error) {
        console.error('Error fetching Pinata data:', error);
      }
    };

    fetchPinataData();
  }, [address, parcels]);

  // Load real data on component mount and set up refresh intervals
  useEffect(() => {
    loadData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    
    // Listen for storage changes to refresh data
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom price update events from AdminDashboard
    const handlePriceUpdate = (event: CustomEvent) => {
      const { parcelId, newPrice } = event.detail;
      
      // Update the current prices state immediately
      setCurrentPrices(prev => ({
        ...prev,
        [parcelId]: newPrice
      }));
      
      // Also refresh all data to ensure consistency
      loadData();
      
      // Force a re-render of computed values
      setTimeout(() => {
        const event = new Event('storage');
        window.dispatchEvent(event);
      }, 100);
    };
    window.addEventListener('priceUpdated', handlePriceUpdate as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('priceUpdated', handlePriceUpdate as EventListener);
    };
  }, []);

  // Calculate real user statistics
  const userStats = useMemo(() => {
    if (!address) return { totalInvested: '$0', landParcels: 0, portfolioValue: '$0', totalReturn: '0%' };
    
    const userTrades = getUserTradesSync(address);
    let totalInvested = 0;
    let totalValue = 0;
    const holdings: Record<string, number> = {};
    
    // Calculate holdings and investments
    userTrades.forEach(trade => {
      if (trade.buyer.toLowerCase() === address.toLowerCase()) {
        holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) + trade.units;
        totalInvested += trade.total;
      }
      if (trade.seller.toLowerCase() === address.toLowerCase()) {
        holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) - trade.units;
        totalInvested -= trade.total;
      }
    });

    // Calculate current portfolio value
    Object.entries(holdings).forEach(([parcelId, units]) => {
      if (units > 0) {
        const price = getPriceOrDefaultSync(parcelId, 2);
        totalValue += units * price;
      }
    });

    const landParcels = Object.values(holdings).filter(units => units > 0).length;
    const pnl = totalValue - totalInvested;
    const returnPercentage = totalInvested > 0 ? ((pnl / totalInvested) * 100) : 0;

    return {
      totalInvested: `$${totalInvested.toFixed(2)}`,
      landParcels,
      portfolioValue: `$${totalValue.toFixed(2)}`,
      totalReturn: `${returnPercentage >= 0 ? '+' : ''}${returnPercentage.toFixed(1)}%`
    };
  }, [address, parcels, currentPrices]);

  // Get available lands (parcels with remaining units)
  const availableLands = useMemo(() => {
    return parcels
      .filter(p => (p.remainingUnits ?? p.units) > 0)
      .map(land => {
        const price = getPriceOrDefaultSync(land.id, 2);
        return {
          id: land.id,
          location: land.location,
          acres: land.acres,
          pricePerUnit: price,
          availableUnits: land.remainingUnits ?? land.units,
          totalUnits: land.units
        };
      });
  }, [parcels, currentPrices]);

  // Get all available sell orders from other users
  const availableSellOrders = useMemo(() => {
    if (!address) return [];
    
    const allTrades = getTradesSync();
    const sellOrders = allTrades.filter(trade => 
      trade.side === 'sell' && 
      trade.buyer === 'listing' && // This indicates it's a listing
      trade.seller.toLowerCase() !== address.toLowerCase() && // Not from current user
      trade.units > 0 // Only show orders with available units
    );

    return sellOrders.map(order => {
      const parcel = parcels.find(p => p.id === order.parcelId);
      if (!parcel) return null;
      
      return {
        ...order,
        location: parcel.location,
        acres: parcel.acres,
        sellerAddress: order.seller
      };
    }).filter(Boolean);
  }, [address, parcels, currentPrices]);

  // Get user's own sell orders
  const userSellOrders = useMemo(() => {
    if (!address) return [];
    
    const allTrades = getTradesSync();
    const sellOrders = allTrades.filter(trade => 
      trade.side === 'sell' && 
      trade.buyer === 'listing' && // This indicates it's a listing
      trade.seller.toLowerCase() === address.toLowerCase() && // From current user
      trade.units > 0 // Only show orders with available units
    );

    return sellOrders.map(order => {
      const parcel = parcels.find(p => p.id === order.parcelId);
      return {
        ...order,
        location: parcel?.location || 'Unknown Location',
        acres: parcel?.acres || 0
      };
    });
  }, [address, parcels, currentPrices]);

  // Get user's current investments
  const userInvestments = useMemo(() => {
    if (!address) return [];
    
    const userTrades = getUserTradesSync(address);
    const holdings: Record<string, number> = {};
    
    userTrades.forEach(trade => {
      if (trade.buyer.toLowerCase() === address.toLowerCase()) {
        holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) + trade.units;
      }
      if (trade.seller.toLowerCase() === address.toLowerCase()) {
        holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) - trade.units;
      }
    });

    return Object.entries(holdings)
      .filter(([_, units]) => units > 0)
      .map(([parcelId, units]) => {
        const parcel = parcels.find(p => p.id === parcelId);
        if (!parcel) return null;
        
        const currentPrice = getPriceOrDefaultSync(parcelId, 2);
        const avgBuyPrice = userTrades
          .filter(t => t.buyer.toLowerCase() === address.toLowerCase() && t.parcelId === parcelId)
          .reduce((sum, t) => sum + t.pricePerUnit, 0) / userTrades.filter(t => t.buyer.toLowerCase() === address.toLowerCase() && t.parcelId === parcelId).length;
        
        const invested = units * avgBuyPrice;
        const currentValue = units * currentPrice;
        const returnPct = ((currentValue - invested) / invested) * 100;

        return {
          id: parcelId,
          location: parcel.location,
          units,
          invested: `$${invested.toFixed(2)}`,
          currentValue: `$${currentValue.toFixed(2)}`,
          return: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`,
          tradeHistory: userTrades.filter(t => t.parcelId === parcelId)
        };
      })
      .filter(Boolean);
  }, [address, parcels, currentPrices]);

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  const handleBuyLand = async (parcelId: string, units: number) => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (units <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid number of units",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const pricePerUnit = await getPriceOrDefault(parcelId, 2).catch(() => getPriceOrDefaultSync(parcelId, 2));
      const totalCost = units * pricePerUnit;
      
      // Check if user has enough LAND tokens
      const userBalance = landBalance ? Number(formatUnits(landBalance as bigint, 18)) : 0;
      if (userBalance < totalCost) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${totalCost} LAND tokens, but you have ${userBalance.toFixed(2)}`,
          variant: "destructive",
        });
        return;
      }

      // Transfer LAND tokens to admin (simulating purchase)
      const amount = parseUnits(totalCost.toString(), 18);
      const txHash = await writeContractAsync({
        abi: [
          { "type":"function","name":"transfer","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}] }
        ],
        address: LAND_TOKEN.address as `0x${string}`,
        functionName: 'transfer',
        args: ['0xC87dAE04cC23b8C078acE5E30F5B2575535a50B0', amount], // Admin address
        account: address as `0x${string}`,
        chain: sepolia,
      });

      // Record the trade
      const trade: any = {
        id: `${Date.now()}`,
        parcelId,
        buyer: address,
        seller: '0xC87dAE04cC23b8C078acE5E30F5B2575535a50B0', // Admin
        units,
        pricePerUnit,
        total: totalCost,
        side: 'buy',
        txHash,
        timestamp: new Date().toISOString(),
      };
      
      await addTrade(trade);
      
      // Update parcel remaining units
      await decrementParcelUnits(parcelId, units);
      
      // Refresh data from IPFS to ensure synchronization
      await refreshDataFromIPFS();
      
      toast({
        title: "Purchase Successful!",
        description: `Bought ${units} units of land for ${totalCost} LAND tokens`,
      });

      // Reset form
      setBuyForm({ parcelId: '', units: '' });

    } catch (error) {
      console.error('Error buying land:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBuyFromOrder = async (orderId: string, units: number) => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const order = availableSellOrders.find(o => o.id === orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const totalCost = units * order.pricePerUnit;
      
      // Check if user has enough LAND tokens
      const userBalance = landBalance ? Number(formatUnits(landBalance as bigint, 18)) : 0;
      if (userBalance < totalCost) {
        toast({
          title: "Insufficient Balance",
          description: `You need ${totalCost} LAND tokens, but you have ${userBalance.toFixed(2)}`,
          variant: "destructive",
        });
        return;
      }

      // Transfer LAND tokens to seller
      const amount = parseUnits(totalCost.toString(), 18);
      const txHash = await writeContractAsync({
        abi: [
          { "type":"function","name":"transfer","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}] }
        ],
        address: LAND_TOKEN.address as `0x${string}`,
        functionName: 'transfer',
        args: [order.seller as `0x${string}`, amount],
        account: address as `0x${string}`,
        chain: sepolia,
      });

      // Record the trade
      const trade: any = {
        id: `${Date.now()}`,
        parcelId: order.parcelId,
        buyer: address,
        seller: order.seller,
        units,
        pricePerUnit: order.pricePerUnit,
        total: totalCost,
        side: 'buy',
        txHash,
        timestamp: new Date().toISOString(),
      };
      
      await addTrade(trade);
      
      // Update the sell order units
      await updateOrderUnits(orderId, order.units - units);
      
      // Refresh data
      await refreshDataFromIPFS();
      
      toast({
        title: "Purchase Successful!",
        description: `Bought ${units} units from seller for ${totalCost} LAND tokens`,
      });

    } catch (error) {
      console.error('Error buying from order:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleListForSale = async () => {
    if (!address || !listForSaleForm.parcelId || !listForSaleForm.units || !listForSaleForm.pricePerUnit) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const units = parseInt(listForSaleForm.units);
    const pricePerUnit = parseFloat(listForSaleForm.pricePerUnit);

    if (units <= 0 || pricePerUnit <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid positive numbers",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Check if user owns enough units
      const userTrades = getUserTradesSync(address);
      const holdings: Record<string, number> = {};
      
      userTrades.forEach(trade => {
        if (trade.buyer.toLowerCase() === address.toLowerCase()) {
          holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) + trade.units;
        }
        if (trade.seller.toLowerCase() === address.toLowerCase()) {
          holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) - trade.units;
        }
      });

      const ownedUnits = holdings[listForSaleForm.parcelId] || 0;
      if (ownedUnits < units) {
        toast({
          title: "Insufficient Units",
          description: `You only own ${ownedUnits} units of this parcel`,
          variant: "destructive",
        });
        return;
      }

      // Create sell order
      const sellOrder: any = {
        id: `${Date.now()}`,
        parcelId: listForSaleForm.parcelId,
        buyer: 'listing', // Special marker for listings
        seller: address,
        units,
        pricePerUnit,
        total: units * pricePerUnit,
        side: 'sell',
        txHash: '',
        timestamp: new Date().toISOString(),
      };
      
      await addTrade(sellOrder);
      await refreshDataFromIPFS();
      
      toast({
        title: "Listed Successfully!",
        description: `Listed ${units} units for sale at $${pricePerUnit} per unit`,
      });

      // Reset form
      setListForSaleForm({ parcelId: '', units: '', pricePerUnit: '' });

    } catch (error) {
      console.error('Error listing for sale:', error);
      toast({
        title: "Listing Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setIsProcessing(true);
    try {
      await removeOrder(orderId);
      await refreshDataFromIPFS();
      
      toast({
        title: "Order Cancelled",
        description: "Your sell order has been cancelled",
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">Please connect your wallet to access the user dashboard.</p>
            <Button onClick={() => navigate('/')}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Dashboard</h1>
            <p className="text-gray-600">Welcome back, {address?.slice(0, 6)}...{address?.slice(-4)}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={refreshDataFromIPFS}
              disabled={isLoadingData}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button onClick={handleDisconnect} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Invested</p>
                  <p className="text-2xl font-bold text-gray-900">{userStats.totalInvested}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Landmark className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Land Parcels</p>
                  <p className="text-2xl font-bold text-gray-900">{userStats.landParcels}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
                  <p className="text-2xl font-bold text-gray-900">{userStats.portfolioValue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Return</p>
                  <p className={`text-2xl font-bold ${userStats.totalReturn.startsWith('+') ? 'text-green-600' : userStats.totalReturn.startsWith('-') ? 'text-red-600' : 'text-gray-900'}`}>
                    {userStats.totalReturn}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LAND Token Balance */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Hash className="h-5 w-5 mr-2" />
              LAND Token Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {landBalance ? Number(formatUnits(landBalance as bigint, 18)).toFixed(2) : '0.00'} LAND
            </p>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Available Lands */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Landmark className="h-5 w-5 mr-2" />
                Available Lands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {availableLands.map((land) => (
                  <div key={land.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{land.location}</h3>
                        <p className="text-sm text-gray-600">{land.acres} acres</p>
                        <p className="text-sm text-gray-600">Available: {land.availableUnits}/{land.totalUnits} units</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${land.pricePerUnit}/unit</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Input
                        type="number"
                        placeholder="Units"
                        value={buyForm.parcelId === land.id ? buyForm.units : ''}
                        onChange={(e) => setBuyForm({ parcelId: land.id, units: e.target.value })}
                        className="flex-1"
                        max={land.availableUnits}
                      />
                      <Button
                        onClick={() => handleBuyLand(land.id, parseInt(buyForm.units) || 0)}
                        disabled={isProcessing || !buyForm.units || buyForm.parcelId !== land.id}
                        size="sm"
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Buy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Sell Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <List className="h-5 w-5 mr-2" />
                Available Sell Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {availableSellOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{order.location}</h3>
                        <p className="text-sm text-gray-600">{order.acres} acres</p>
                        <p className="text-sm text-gray-600">Seller: {order.sellerAddress?.slice(0, 6)}...{order.sellerAddress?.slice(-4)}</p>
                        <p className="text-sm text-gray-600">Available: {order.units} units</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">${order.pricePerUnit}/unit</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Input
                        type="number"
                        placeholder="Units"
                        value={orderForms[order.id] || ''}
                        onChange={(e) => setOrderForms({ ...orderForms, [order.id]: e.target.value })}
                        className="flex-1"
                        max={order.units}
                      />
                      <Button
                        onClick={() => handleBuyFromOrder(order.id, parseInt(orderForms[order.id]) || 0)}
                        disabled={isProcessing || !orderForms[order.id]}
                        size="sm"
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Buy
                      </Button>
                    </div>
                  </div>
                ))}
                {availableSellOrders.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No sell orders available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* List Land for Sale */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                List Land for Sale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sellParcelId">Select Parcel</Label>
                  <select
                    id="sellParcelId"
                    value={listForSaleForm.parcelId}
                    onChange={(e) => setListForSaleForm({ ...listForSaleForm, parcelId: e.target.value })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select a parcel you own</option>
                    {userInvestments.map((investment) => (
                      <option key={investment.id} value={investment.id}>
                        {investment.location} ({investment.units} units owned)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="sellUnits">Units to Sell</Label>
                  <Input
                    id="sellUnits"
                    type="number"
                    value={listForSaleForm.units}
                    onChange={(e) => setListForSaleForm({ ...listForSaleForm, units: e.target.value })}
                    placeholder="Number of units"
                  />
                </div>
                <div>
                  <Label htmlFor="sellPrice">Price per Unit ($)</Label>
                  <Input
                    id="sellPrice"
                    type="number"
                    step="0.01"
                    value={listForSaleForm.pricePerUnit}
                    onChange={(e) => setListForSaleForm({ ...listForSaleForm, pricePerUnit: e.target.value })}
                    placeholder="Price per unit"
                  />
                </div>
                <Button
                  onClick={handleListForSale}
                  disabled={isProcessing || !listForSaleForm.parcelId || !listForSaleForm.units || !listForSaleForm.pricePerUnit}
                  className="w-full"
                >
                  List for Sale
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Your Sell Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Your Sell Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {userSellOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{order.location}</h3>
                        <p className="text-sm text-gray-600">{order.acres} acres</p>
                        <p className="text-sm text-gray-600">Units: {order.units}</p>
                        <p className="text-sm text-gray-600">Price: ${order.pricePerUnit}/unit</p>
                      </div>
                      <Button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={isProcessing}
                        variant="destructive"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
                {userSellOrders.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No active sell orders</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Your Investments */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Your Investments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Location</th>
                    <th className="text-left p-2">Units Owned</th>
                    <th className="text-left p-2">Amount Invested</th>
                    <th className="text-left p-2">Current Value</th>
                    <th className="text-left p-2">Return</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userInvestments.map((investment) => (
                    <tr key={investment.id} className="border-b">
                      <td className="p-2">{investment.location}</td>
                      <td className="p-2">{investment.units}</td>
                      <td className="p-2">{investment.invested}</td>
                      <td className="p-2">{investment.currentValue}</td>
                      <td className={`p-2 font-semibold ${investment.return.startsWith('+') ? 'text-green-600' : investment.return.startsWith('-') ? 'text-red-600' : 'text-gray-900'}`}>
                        {investment.return}
                      </td>
                      <td className="p-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedInvestment(investment)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Investment Details - {investment.location}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold mb-2">Trade History</h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {investment.tradeHistory.map((trade) => (
                                    <div key={trade.id} className="border rounded p-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className={trade.side === 'buy' ? 'text-green-600' : 'text-red-600'}>
                                          {trade.side.toUpperCase()}
                                        </span>
                                        <span>{new Date(trade.timestamp).toLocaleDateString()}</span>
                                      </div>
                                      <div>Units: {trade.units} @ ${trade.pricePerUnit}/unit</div>
                                      <div>Total: ${trade.total}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {userInvestments.length === 0 && (
                <p className="text-gray-500 text-center py-8">No investments yet. Start by buying some land!</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;