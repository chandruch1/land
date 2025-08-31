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
import { getParcels, type TokenizedParcel, decrementParcelUnits } from '@/lib/parcels';
import { getTrades, getUserTrades, addTrade, getPriceOrDefault, getPrices, updateOrderUnits, removeOrder } from '@/lib/trades';
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

  // Get user's LAND token balance
  const { data: landBalance } = useReadContract({
    abi: [
      { "type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}] }
    ],
    address: LAND_TOKEN.address as `0x${string}`,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
  });

  // Fetch Pinata data for user's address
  useEffect(() => {
    const fetchPinataData = async () => {
      if (!address) return;
      
      try {
        // This would be your actual Pinata API call
        // For now, we'll simulate it with the existing data
        const userTrades = getUserTrades(address);
        const userParcels = userTrades
          .filter(t => t.buyer.toLowerCase() === address.toLowerCase())
          .map(t => {
            const parcel = getParcels().find(p => p.id === t.parcelId);
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

  // Load real data
  useEffect(() => {
    const loadData = () => {
      const allParcels = getParcels();
      setParcels(allParcels);
      
      const prices = getPrices();
      const priceMap: Record<string, number> = {};
      Object.keys(prices).forEach(parcelId => {
        priceMap[parcelId] = prices[parcelId].currentPrice;
      });
      setCurrentPrices(priceMap);
    };

    loadData();
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    
    // Listen for storage changes to refresh data
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Calculate real user statistics
  const userStats = useMemo(() => {
    if (!address) return { totalInvested: '$0', landParcels: 0, portfolioValue: '$0', totalReturn: '0%' };
    
    const userTrades = getUserTrades(address);
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
        const price = getPriceOrDefault(parcelId, 2);
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
      .map(land => ({
        id: land.id,
        location: land.location,
        acres: land.acres,
        pricePerUnit: getPriceOrDefault(land.id, 2),
        availableUnits: land.remainingUnits ?? land.units,
        totalUnits: land.units
      }));
  }, [parcels, currentPrices]);

  // Get all available sell orders from other users
  const availableSellOrders = useMemo(() => {
    if (!address) return [];
    
    const allTrades = getTrades();
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
    
    const allTrades = getTrades();
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
    
    const userTrades = getUserTrades(address);
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
        
        const currentPrice = getPriceOrDefault(parcelId, 2);
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
      const pricePerUnit = getPriceOrDefault(parcelId, 2);
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
      
      addTrade(trade);
      
      // Update parcel remaining units
      decrementParcelUnits(parcelId, units);
      
      // Refresh data
      setParcels(getParcels());
      
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

  const handleBuyTokens = async () => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    const amount = Number(buyTokensForm.amount);
    if (amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simulate buying tokens from admin
      // In a real scenario, this would involve a smart contract call
      toast({
        title: "Token Purchase Request",
        description: `Requested ${amount} LAND tokens from admin. Please wait for approval.`,
      });

      setBuyTokensForm({ amount: '' });
    } catch (error) {
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
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    const { parcelId, units, pricePerUnit } = listForSaleForm;
    if (!parcelId || !units || !pricePerUnit) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const unitsNum = Number(units);
    const priceNum = Number(pricePerUnit);

    if (unitsNum <= 0 || priceNum <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid amounts",
        variant: "destructive",
      });
      return;
    }

    // Check if user has enough units to sell
    const userTrades = getUserTrades(address);
    const holdings: Record<string, number> = {};
    
    userTrades.forEach(trade => {
      if (trade.buyer.toLowerCase() === address.toLowerCase()) {
        holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) + trade.units;
      }
      if (trade.seller.toLowerCase() === address.toLowerCase()) {
        holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) - trade.units;
      }
    });

    const availableUnits = holdings[parcelId] || 0;
    if (availableUnits < unitsNum) {
      toast({
        title: "Insufficient Units",
        description: `You only have ${availableUnits} units available for sale`,
        variant: "destructive",
      });
      return;
    }

    // Create sell listing
    const trade: any = {
      id: `${Date.now()}`,
      parcelId,
      buyer: 'listing', // Indicates it's a listing
      seller: address,
      units: unitsNum,
      pricePerUnit: priceNum,
      total: unitsNum * priceNum,
      side: 'sell',
      txHash: 'pending',
      timestamp: new Date().toISOString(),
    };
    
    addTrade(trade);
    
    toast({
      title: "Listed for Sale",
      description: `${unitsNum} units listed at ${priceNum} LAND per unit`,
    });

    setListForSaleForm({ parcelId: '', units: '', pricePerUnit: '' });
  };

  const handleBuyOrder = async (orderId: string) => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    const units = orderForms[orderId];
    if (!units) {
      toast({
        title: "Error",
        description: "Please enter units to buy",
        variant: "destructive",
      });
      return;
    }

    const unitsNum = Number(units);
    if (unitsNum <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid number of units",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const order = getTrades().find(t => t.id === orderId);
      if (!order) {
        toast({
          title: "Error",
          description: "Order not found",
          variant: "destructive",
        });
        return;
      }

      if (order.seller.toLowerCase() === address.toLowerCase()) {
        toast({
          title: "Error",
          description: "You cannot buy your own order",
          variant: "destructive",
        });
        return;
      }

      if (order.units < unitsNum) {
        toast({
          title: "Error",
          description: `Only ${order.units} units available for this order`,
          variant: "destructive",
        });
        return;
      }

      const pricePerUnit = order.pricePerUnit;
      const totalCost = unitsNum * pricePerUnit;

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
        units: unitsNum,
        pricePerUnit: pricePerUnit,
        total: totalCost,
        side: 'buy',
        txHash,
        timestamp: new Date().toISOString(),
      };
      
      addTrade(trade);
      
      // Update the original sell order to reduce available units
      updateOrderUnits(orderId, unitsNum);
      
      // Refresh data
      setParcels(getParcels());
      
      // Force refresh of trades data
      const event = new Event('storage');
      window.dispatchEvent(event);
      
      toast({
        title: "Order Filled",
        description: `Bought ${unitsNum} units from order ${orderId} for ${totalCost} LAND tokens`,
      });

      // Reset form for this specific order
      setOrderForms(prev => {
        const newForms = { ...prev };
        delete newForms[orderId];
        return newForms;
      });

    } catch (error) {
      console.error('Error buying order:', error);
      toast({
        title: "Order Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    const order = getTrades().find(t => t.id === orderId);
    if (!order) {
      toast({
        title: "Error",
        description: "Order not found",
        variant: "destructive",
      });
      return;
    }

    if (order.seller.toLowerCase() !== address.toLowerCase()) {
      toast({
        title: "Error",
        description: "You can only cancel your own orders",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Since the smart contract doesn't have a cancelOrder function,
      // we'll just remove the order from local storage
      removeOrder(orderId);
      
      // Refresh data
      setParcels(getParcels());
      
      // Force refresh of trades data
      const event = new Event('storage');
      window.dispatchEvent(event);
      
      toast({
        title: "Order Cancelled",
        description: `Your order ${orderId} has been cancelled successfully.`,
      });

    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: "Cancel Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const refreshData = () => {
    setParcels(getParcels());
    const prices = getPrices();
    const priceMap: Record<string, number> = {};
    Object.keys(prices).forEach(parcelId => {
      priceMap[parcelId] = prices[parcelId].currentPrice;
    });
    setCurrentPrices(priceMap);
    
    // Clear all order forms when refreshing
    setOrderForms({});
    
    toast({
      title: "Data Refreshed",
      description: "Portfolio data has been updated",
    });
  };

  const openInvestmentDetails = (investment: any) => {
    setSelectedInvestment(investment);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 p-6">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
              <Landmark className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Dashboard</h1>
              <p className="text-gray-600">Manage your land investments</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Connected as User</p>
              <p className="text-sm font-mono text-gray-700">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
              <p className="text-xs text-gray-500">LAND Balance: {landBalance ? formatUnits(landBalance as bigint, 18) : '0'}</p>
            </div>
            <Button variant="outline" onClick={handleDisconnect} className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50">
              <LogOut className="w-4 h-4" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Invested</p>
                  <p className="text-2xl font-bold text-gray-900">{userStats.totalInvested}</p>
                </div>
                <DollarSign className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Land Parcels</p>
                  <p className="text-2xl font-bold text-gray-900">{userStats.landParcels}</p>
                </div>
                <Landmark className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Portfolio Value</p>
                  <p className="text-2xl font-bold text-gray-900">{userStats.portfolioValue}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Return</p>
                  <p className={`text-2xl font-bold ${userStats.totalReturn.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {userStats.totalReturn}
                  </p>
                </div>
                <Users className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Buy Tokens Section */}
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Plus className="w-5 h-5" />
              Buy LAND Tokens from Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="tokenAmount" className="text-gray-700">Amount of LAND Tokens</Label>
                <Input
                  id="tokenAmount"
                  type="number"
                  placeholder="Enter amount"
                  value={buyTokensForm.amount}
                  onChange={(e) => setBuyTokensForm({ amount: e.target.value })}
                  className="mt-1"
                />
              </div>
              <Button 
                variant="default" 
                onClick={handleBuyTokens}
                disabled={isProcessing || !buyTokensForm.amount}
                className="bg-gray-900 text-white hover:bg-gray-800"
              >
                {isProcessing ? 'Processing...' : 'Buy Tokens'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Available Lands */}
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Eye className="w-5 h-5" />
                Available Lands
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableLands.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No lands available for purchase</p>
              ) : (
                availableLands.map((land) => (
                  <div key={land.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{land.location}</h3>
                        <p className="text-xs text-gray-500 font-mono">Land ID: #{land.id}</p>
                      </div>
                      <span className="text-sm text-gray-600">{land.acres} acres</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Price per Unit:</span>
                        <span className="ml-2 font-semibold text-gray-900">{land.pricePerUnit} LAND</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Available:</span>
                        <span className="ml-2 font-semibold text-gray-900">{land.availableUnits}/{land.totalUnits}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Units to buy"
                          value={buyForm.parcelId === land.id ? buyForm.units : ''}
                          onChange={(e) => setBuyForm({ parcelId: land.id, units: e.target.value })}
                          className="flex-1"
                        />
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="bg-gray-900 text-white hover:bg-gray-800"
                          onClick={() => handleBuyLand(land.id, Number(buyForm.units))}
                          disabled={isProcessing || buyForm.parcelId !== land.id || !buyForm.units}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          {isProcessing ? 'Processing...' : 'Buy'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Cost: {buyForm.parcelId === land.id && buyForm.units ? 
                          `${(Number(buyForm.units) * land.pricePerUnit).toFixed(2)} LAND` : 
                          'Enter units to see cost'
                        }
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* User Investments */}
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <TrendingUp className="w-5 h-5" />
                Your Investments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {userInvestments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No investments yet. Start buying land to see your portfolio!</p>
              ) : (
                userInvestments.map((investment) => (
                  <div key={investment.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{investment.location}</h3>
                        <p className="text-xs text-gray-500 font-mono">Land ID: #{investment.id}</p>
                      </div>
                      <span className={`text-sm font-semibold ${investment.return.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {investment.return}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Units:</span>
                        <span className="ml-2 font-semibold text-gray-900">{investment.units}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Invested:</span>
                        <span className="ml-2 font-semibold text-gray-900">{investment.invested}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Current Value: <span className="font-semibold text-gray-900">{investment.currentValue}</span>
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                        onClick={() => openInvestmentDetails(investment)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* List for Sale Section */}
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <List className="w-5 h-5" />
              List Your Land for Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="sellParcelId" className="text-gray-700">Land ID</Label>
                <Input
                  id="sellParcelId"
                  placeholder="Enter land ID"
                  value={listForSaleForm.parcelId}
                  onChange={(e) => setListForSaleForm(prev => ({ ...prev, parcelId: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Available IDs: {userInvestments.map(inv => inv.id).join(', ')}</p>
              </div>
              <div>
                <Label htmlFor="sellUnits" className="text-gray-700">Units to Sell</Label>
                <Input
                  id="sellUnits"
                  type="number"
                  placeholder="Enter units"
                  value={listForSaleForm.units}
                  onChange={(e) => setListForSaleForm(prev => ({ ...prev, units: e.target.value }))}
                  className="mt-1"
                />
                {listForSaleForm.parcelId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {(() => {
                      const userTrades = getUserTrades(address || '');
                      const holdings: Record<string, number> = {};
                      userTrades.forEach(trade => {
                        if (trade.buyer.toLowerCase() === (address || '').toLowerCase()) {
                          holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) + trade.units;
                        }
                        if (trade.seller.toLowerCase() === (address || '').toLowerCase()) {
                          holdings[trade.parcelId] = (holdings[trade.parcelId] || 0) - trade.units;
                        }
                      });
                      return holdings[listForSaleForm.parcelId] || 0;
                    })()} units
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="sellPrice" className="text-gray-700">Price per Unit (LAND)</Label>
                <Input
                  id="sellPrice"
                  type="number"
                  placeholder="Enter price"
                  value={listForSaleForm.pricePerUnit}
                  onChange={(e) => setListForSaleForm(prev => ({ ...prev, pricePerUnit: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <Button 
                variant="default" 
                onClick={handleListForSale}
                disabled={isProcessing || !listForSaleForm.parcelId || !listForSaleForm.units || !listForSaleForm.pricePerUnit}
                className="bg-gray-900 text-white hover:bg-gray-800"
              >
                {isProcessing ? 'Processing...' : 'List for Sale'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders Summary */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <ShoppingCart className="w-5 h-5" />
                Available Orders from Others
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{availableSellOrders.length}</p>
                <p className="text-sm text-gray-600">Sell orders available</p>
                <p className="text-xs text-gray-500 mt-2">
                  Total units: {availableSellOrders.reduce((sum, order) => sum + order.units, 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <List className="w-5 h-5" />
                Your Sell Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{userSellOrders.length}</p>
                <p className="text-sm text-gray-600">Orders you've listed</p>
                <p className="text-xs text-gray-500 mt-2">
                  Total units: {userSellOrders.reduce((sum, order) => sum + order.units, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Sell Orders */}
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 mt-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <ShoppingCart className="w-5 h-5" />
                Available Sell Orders from Other Users
              </CardTitle>
              {Object.keys(orderForms).length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => setOrderForms({})}
                >
                  Clear All Forms
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableSellOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No available sell orders yet.</p>
            ) : (
              availableSellOrders.map((order) => (
                <div key={order.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{order.location}</h3>
                      <p className="text-xs text-gray-500 font-mono">Order ID: #{order.id} | Land ID: #{order.parcelId}</p>
                    </div>
                    <span className="text-sm text-gray-600">Seller: {order.sellerAddress.slice(0, 8)}...{order.sellerAddress.slice(-6)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Available Units:</span>
                      <span className="ml-2 font-semibold text-gray-900">{order.units}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Price per Unit:</span>
                      <span className="ml-2 font-semibold text-gray-900">{order.pricePerUnit} LAND</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Units to buy"
                        value={orderForms[order.id] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow empty value for clearing
                          if (value === '') {
                            setOrderForms(prev => ({ ...prev, [order.id]: '' }));
                            return;
                          }
                          
                          const numValue = Number(value);
                          // Allow any positive number, validation will happen on button click
                          if (numValue >= 0 && numValue <= order.units) {
                            setOrderForms(prev => ({ ...prev, [order.id]: value }));
                          }
                        }}
                        onKeyDown={(e) => {
                          // Allow backspace, delete, arrow keys, and numbers
                          if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                            return;
                          }
                          // Allow numbers and decimal point
                          if (/[0-9]/.test(e.key)) {
                            return;
                          }
                          e.preventDefault();
                        }}
                        className="flex-1"
                        min="1"
                        max={order.units}
                      />
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="bg-gray-900 text-white hover:bg-gray-800"
                        onClick={() => handleBuyOrder(order.id)}
                        disabled={isProcessing || !orderForms[order.id] || Number(orderForms[order.id]) > order.units}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {isProcessing ? 'Processing...' : 'Buy Units'}
                      </Button>
                      {orderForms[order.id] && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-gray-300 text-gray-700 hover:bg-gray-50"
                          onClick={() => setOrderForms(prev => ({ ...prev, [order.id]: '' }))}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {orderForms[order.id] && (
                      <p className="text-xs text-gray-500">
                        Cost: {Number(orderForms[order.id]) * order.pricePerUnit} LAND
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* User's Own Sell Orders */}
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <List className="w-5 h-5" />
              Your Sell Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {userSellOrders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">You haven't listed any land for sale yet.</p>
            ) : (
              userSellOrders.map((order) => (
                <div key={order.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{order.location}</h3>
                      <p className="text-xs text-gray-500 font-mono">Order ID: #{order.id} | Land ID: #{order.parcelId}</p>
                    </div>
                    <span className="text-sm text-gray-600">Listed: {new Date(order.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Units Listed:</span>
                      <span className="ml-2 font-semibold text-gray-900">{order.units}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Price per Unit:</span>
                      <span className="ml-2 font-semibold text-gray-900">{order.pricePerUnit} LAND</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Total Value: <span className="font-semibold text-gray-900">{order.total} LAND</span>
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Cancel Order'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>



        {/* Refresh Button */}
        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            onClick={refreshData}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Investment Details Dialog */}
      <Dialog open={!!selectedInvestment} onOpenChange={() => setSelectedInvestment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5" />
              Investment Details - {selectedInvestment?.location}
            </DialogTitle>
          </DialogHeader>
          {selectedInvestment && (
            <div className="space-y-6">
              {/* Investment Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Total Units</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedInvestment.units}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Invested</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedInvestment.invested}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Current Value</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedInvestment.currentValue}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Return</p>
                  <p className={`text-lg font-semibold ${selectedInvestment.return.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedInvestment.return}
                  </p>
                </div>
              </div>

              {/* Transaction History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Transaction History</h3>
                <div className="space-y-3">
                  {selectedInvestment.tradeHistory?.map((trade: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${trade.side === 'buy' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium text-gray-900">
                            {trade.side === 'buy' ? 'Purchased' : 'Sold'} {trade.units} units
                          </p>
                          <p className="text-sm text-gray-600">
                            Price: {trade.pricePerUnit} LAND per unit
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {new Date(trade.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </p>
                        {trade.txHash && trade.txHash !== 'pending' && (
                          <p className="text-xs text-gray-500">
                            <Hash className="w-3 h-3 inline mr-1" />
                            {trade.txHash.slice(0, 8)}...{trade.txHash.slice(-6)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pinata Data */}
              {pinataData.find(p => p.id === selectedInvestment.id) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Land Details</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Location:</strong> {pinataData.find(p => p.id === selectedInvestment.id)?.location}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Acres:</strong> {pinataData.find(p => p.id === selectedInvestment.id)?.acres}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Metadata:</strong> 
                      <a 
                        href={pinataData.find(p => p.id === selectedInvestment.id)?.pinataUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline ml-2"
                      >
                        View on IPFS
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDashboard;