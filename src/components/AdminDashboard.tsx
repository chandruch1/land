import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/enhanced-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount, useDisconnect } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { pinJsonToIPFS } from '@/config/pinata';
import { LAND_TOKEN } from '@/config/wagmi';
import { addParcel, getParcels, getParcelsSync, type TokenizedParcel, refreshParcelsFromIPFS } from '@/lib/parcels';
import { setPrice, getPriceOrDefault, getPriceOrDefaultSync, getPrices, getPricesSync, refreshPricesFromIPFS } from '@/lib/trades';
import { 
  Landmark, 
  Settings, 
  DollarSign, 
  Users, 
  FileText,
  LogOut,
  Upload,
  ToggleLeft,
  RefreshCw
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { removeParcel } from '@/lib/parcels';
import { getPlatformFee, setPlatformFee } from '@/lib/settings';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';

const AdminDashboard = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [tokenizeForm, setTokenizeForm] = useState({
    location: '',
    acres: '',
    units: '0',
    pricePerUnit: '2',
    metadataURI: ''
  });
  
  const [feeForm, setFeeForm] = useState({
    feePercentage: getPlatformFee()
  });

  const [isTokenizing, setIsTokenizing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [parcels, setParcels] = useState<TokenizedParcel[]>(() => getParcelsSync());
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(() => {
    const prices = getPricesSync();
    const priceMap: Record<string, number> = {};
    Object.keys(prices).forEach(parcelId => {
      priceMap[parcelId] = prices[parcelId].currentPrice;
    });
    return priceMap;
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

  // Function to refresh current prices from storage
  const refreshCurrentPrices = async () => {
    const prices = await getPrices().catch(() => getPricesSync());
    const priceMap: Record<string, number> = {};
    Object.keys(prices).forEach(parcelId => {
      priceMap[parcelId] = prices[parcelId].currentPrice;
    });
    setCurrentPrices(priceMap);
  };

  const { data: landBalance } = useReadContract({
    abi: [
      { "type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"name":"","type":"uint256"}] }
    ],
    address: LAND_TOKEN.address as `0x${string}`,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
  });

  // Listen for storage changes to refresh data and load data on mount
  useEffect(() => {
    loadData();
    
    const handleStorageChange = () => {
      loadData();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Function to get current price from state
  const getCurrentPrice = (parcelId: string) => {
    // First check the current prices state (most up-to-date)
    if (currentPrices[parcelId] !== undefined) {
      return currentPrices[parcelId];
    }
    
    // Fall back to storage if not in state
    const storedPrice = getPriceOrDefaultSync(parcelId, 2);
    return storedPrice;
  };

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  const handleTokenizeLand = async () => {
    if (!tokenizeForm.location || !tokenizeForm.acres) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    setIsTokenizing(true);
    
    try {
      toast({
        title: "Uploading to IPFS",
        description: "Creating metadata on Pinata...",
      });

      // Create metadata for the land
      const landMetadata = {
        name: `Land Parcel - ${tokenizeForm.location}`,
        description: `${tokenizeForm.acres} acres of land in ${tokenizeForm.location}`,
        location: tokenizeForm.location,
        acres: parseFloat(tokenizeForm.acres),
        units: parseInt(tokenizeForm.units || '0'),
        tokenized_at: new Date().toISOString(),
        contract_address: '0x2089cb616333462e0987105f137DD8Af2C190957'
      };

      // Upload directly to Pinata via JWT
      const pin = await pinJsonToIPFS(landMetadata, {
        name: `land-${tokenizeForm.location.replace(/\s+/g, '-').toLowerCase()}`,
        keyvalues: {
          contractAddress: '0x2089cb616333462e0987105f137DD8Af2C190957',
          location: tokenizeForm.location,
          acres: tokenizeForm.acres
        }
      });

      if (pin?.ipfsUrl) {
        const metadataURI = pin.ipfsUrl;
        
        toast({
          title: "Metadata Uploaded",
          description: `IPFS Hash: ${pin.ipfsHash}`,
        });

        // Update the form with the metadata URI
        setTokenizeForm(prev => ({ ...prev, metadataURI }));

        // Persist newly tokenized parcel
        const newParcel: TokenizedParcel = {
          id: `${Date.now()}`,
          location: tokenizeForm.location,
          acres: parseFloat(tokenizeForm.acres),
          units: parseInt(tokenizeForm.units || '0'),
          remainingUnits: parseInt(tokenizeForm.units || '0'),
          metadataURI,
          ipfsHash: pin.ipfsHash,
          createdAt: new Date().toISOString(),
        };
        addParcel(newParcel);
        
        // Set the price per unit for this parcel - use the form value
        const pricePerUnit = parseFloat(tokenizeForm.pricePerUnit || '2');
        setPrice(newParcel.id, pricePerUnit);
        
        // Update current prices state
        setCurrentPrices(prev => ({
          ...prev,
          [newParcel.id]: pricePerUnit
        }));
        
        setParcels(getParcelsSync());

        toast({
          title: "Land Tokenized Successfully",
          description: `${tokenizeForm.location} has been tokenized with metadata stored on IPFS`,
        });

        console.log('Land tokenized successfully:', {
          ...tokenizeForm,
          metadataURI,
          ipfsHash: pin.ipfsHash
        });

      } else {
        throw new Error('Failed to upload metadata to Pinata');
      }

    } catch (error) {
      console.error('Error tokenizing land:', error);
      toast({
        title: "Tokenization Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsTokenizing(false);
    }
  };

  const handleSetPlatformFee = async () => {
    if (!feeForm.feePercentage) {
      toast({
        title: "Error",
        description: "Please enter a fee percentage",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Setting Platform Fee",
      description: `Setting fee to ${feeForm.feePercentage}%`,
    });
    
    setPlatformFee(feeForm.feePercentage);
    setFeeForm({ feePercentage: getPlatformFee() });
  };

  const handleWithdrawFees = async () => {
    toast({
      title: "Withdrawing Fees",
      description: "Processing fee withdrawal...",
    });
    
    // Smart contract interaction would go here
    console.log('Withdrawing fees');
  };

  const adminActions = [
    {
      icon: <Upload className="w-5 h-5" />,
      title: "Tokenize Land",
      description: "Convert physical land into digital fractions",
      action: "tokenize"
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: "Platform Settings",
      description: "Configure platform fees and parameters",
      action: "settings"
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      title: "Withdraw Fees",
      description: "Collect accumulated platform fees",
      action: "withdraw"
    },
    {
      icon: <ToggleLeft className="w-5 h-5" />,
      title: "Land Management",
      description: "Activate/deactivate land parcels",
      action: "manage"
    }
  ];

  // Tokenized parcels are read from local storage via `parcels` state

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
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Manage land tokenization platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Connected as Admin</p>
              <p className="text-sm font-mono text-gray-700">{address?.slice(0, 8)}...{address?.slice(-6)}</p>
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
                  <p className="text-gray-600 text-sm">Total Lands</p>
                  <p className="text-2xl font-bold text-gray-900">{parcels.length}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">1,247</p>
                </div>
                <Users className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">—</p>
                </div>
                <DollarSign className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Platform Fees</p>
                  <p className="text-2xl font-bold text-gray-900">{feeForm.feePercentage || '—'}%</p>
                </div>
                <Settings className="w-8 h-8 text-gray-700" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Tokenize Land Form */}
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Upload className="w-5 h-5" />
                Tokenize New Land
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="location" className="text-gray-900">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Chennai Downtown"
                  value={tokenizeForm.location}
                  onChange={(e) => setTokenizeForm(prev => ({ ...prev, location: e.target.value }))}
                  className="bg-gray-50 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <div>
                <Label htmlFor="acres" className="text-gray-900">Acres</Label>
                <Input
                  id="acres"
                  type="number"
                  placeholder="e.g., 5.5"
                  value={tokenizeForm.acres}
                  onChange={(e) => setTokenizeForm(prev => ({ ...prev, acres: e.target.value }))}
                  className="bg-gray-50 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <div>
                <Label htmlFor="units" className="text-gray-900">Units</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setTokenizeForm(prev => ({ ...prev, units: String(Math.max(0, parseInt(prev.units || '0') - 1)) }))} className="border-gray-300 text-gray-700 hover:bg-gray-50">-</Button>
                  <Input
                    id="units"
                    type="number"
                    placeholder="e.g., 1000"
                    value={tokenizeForm.units}
                    onChange={(e) => setTokenizeForm(prev => ({ ...prev, units: e.target.value }))}
                    className="bg-gray-50 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                  />
                  <Button type="button" variant="outline" onClick={() => setTokenizeForm(prev => ({ ...prev, units: String((parseInt(prev.units || '0') + 1)) }))} className="border-gray-300 text-gray-700 hover:bg-gray-50">+</Button>
                </div>
              </div>
              <div>
                <Label htmlFor="pricePerUnit" className="text-gray-900">Price per Unit (LAND)</Label>
                <Input
                  id="pricePerUnit"
                  type="number"
                  placeholder="e.g., 2"
                  value={tokenizeForm.pricePerUnit}
                  onChange={(e) => setTokenizeForm(prev => ({ ...prev, pricePerUnit: e.target.value }))}
                  className="bg-gray-50 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <div>
                <Label htmlFor="metadata" className="text-gray-900">Metadata URI (Optional)</Label>
                <Input
                  id="metadata"
                  placeholder="ipfs://..."
                  value={tokenizeForm.metadataURI}
                  onChange={(e) => setTokenizeForm(prev => ({ ...prev, metadataURI: e.target.value }))}
                  className="bg-gray-50 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <Button 
                variant="default" 
                className="w-full bg-gray-900 text-white hover:bg-gray-800" 
                onClick={handleTokenizeLand}
                disabled={isTokenizing}
              >
                {isTokenizing ? 'Processing...' : 'Tokenize Land'}
              </Button>
            </CardContent>
          </Card>

          {/* Platform Settings */}
          <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Settings className="w-5 h-5" />
                Platform Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fee" className="text-gray-900">Platform Fee (%)</Label>
                <Input
                  id="fee"
                  type="number"
                  placeholder="e.g., 2.5"
                  value={feeForm.feePercentage}
                  onChange={(e) => setFeeForm(prev => ({ ...prev, feePercentage: e.target.value }))}
                  className="bg-gray-50 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                />
              </div>
              <Button variant="default" className="w-full bg-gray-900 text-white hover:bg-gray-800" onClick={handleSetPlatformFee}>
                Set Platform Fee
              </Button>
              
              <div className="pt-4 border-t border-gray-200">
                <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50" onClick={handleWithdrawFees}>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Withdraw Platform Fees
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Land Parcels Table */}
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="w-5 h-5" />
              Tokenized Land Parcels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="table-professional">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Location</th>
                    <th>Acres</th>
                    <th>Units</th>
                    <th>Remaining</th>
                    <th>Price/Unit</th>
                    <th>IPFS</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parcels.map((land) => (
                    <tr key={land.id}>
                      <td className="text-gray-600">#{land.id}</td>
                      <td className="text-gray-900">{land.location}</td>
                      <td className="text-gray-600">{land.acres}</td>
                      <td className="text-gray-600">{land.units}</td>
                      <td className="text-gray-600">{land.remainingUnits ?? land.units}</td>
                      <td className="text-gray-900 font-semibold">${getCurrentPrice(land.id)}</td>
                      <td className="text-gray-700 font-semibold"><a className="underline text-gray-600 hover:text-gray-900" href={land.metadataURI} target="_blank" rel="noreferrer">View</a></td>
                      <td className="text-gray-600">{new Date(land.createdAt).toLocaleString()}</td>
                      <td>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                              Manage
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Manage Parcel #{land.id}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2 text-sm">
                              <div><span className="text-gray-600">Location:</span> {land.location}</div>
                              <div><span className="text-gray-600">Acres:</span> {land.acres}</div>
                              <div><span className="text-gray-600">Current Price:</span> ${getCurrentPrice(land.id)} per unit</div>
                              <div>
                                <span className="text-gray-600">IPFS:</span> <a className="text-gray-600 underline hover:text-gray-900" href={land.metadataURI} target="_blank" rel="noreferrer">Open</a>
                              </div>
                              <div className="pt-2">
                                <Button
                                  variant="destructive"
                                  onClick={() => { removeParcel(land.id); setParcels(getParcelsSync()); }}
                                >
                                  Delete Parcel (local)
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;