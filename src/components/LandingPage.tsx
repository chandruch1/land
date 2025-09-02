import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/enhanced-button';
import WalletConnect from '@/components/WalletConnect';
import { ADMIN_WALLET } from '@/config/wagmi';
import { Landmark, TrendingUp, Shield, Users, ArrowRight, CheckCircle, Star, Layers, Lock, FileText, Globe, ListOrdered } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const LandingPage = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      if (address.toLowerCase() === ADMIN_WALLET.toLowerCase()) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isConnected, address, navigate]);

  const features = [
    {
      icon: <Landmark className="w-8 h-8" />,
      title: "Tokenize Land",
      description: "Convert physical land assets into digital fractions with blockchain verification",
      benefits: ["Secure ownership", "Transparent records", "Global accessibility"]
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Trade Fractions",
      description: "Buy and sell land fractions on our decentralized marketplace",
      benefits: ["24/7 trading", "Real-time pricing", "Instant settlement"]
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure Ownership",
      description: "Blockchain-verified ownership with transparent transaction history",
      benefits: ["Immutable records", "Smart contracts", "Audit trail"]
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Shared Investment",
      description: "Democratize land investment for everyone, regardless of capital",
      benefits: ["Fractional ownership", "Diversified portfolio", "Lower barriers"]
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Real Estate Investor",
      content: "LandShare Protocol has revolutionized how I think about real estate investment. The fractionalization makes it accessible to everyone.",
      rating: 5
    },
    {
      name: "Michael Rodriguez",
      role: "Property Developer",
      content: "The platform's transparency and security give me confidence in every transaction. It's the future of real estate.",
      rating: 5
    },
    {
      name: "Emily Watson",
      role: "Retail Investor",
      content: "Finally, I can invest in premium real estate without needing millions. The user experience is exceptional.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-white via-gray-50 to-gray-100">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gray-200 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-gray-300 rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-gray-200 rounded-full blur-3xl animate-pulse delay-2000" />
        <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-gray-300 rounded-full blur-xl animate-pulse delay-500" />
        <div className="absolute bottom-20 right-1/3 w-16 h-16 bg-gray-200 rounded-full blur-lg animate-pulse delay-1500" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Professional Header */}
        <header className="nav-professional sticky top-0 z-50 -mx-4 px-4 py-4 mb-16 rounded-b-2xl bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-900 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
                <Landmark className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LandShare Protocol</h1>
                <p className="text-sm text-gray-600">Professional Land Fractionalization</p>
              </div>
            </div>
            
            {!isConnected && (
              <WalletConnect />
            )}
          </div>
        </header>

        {/* Enhanced Hero Section */}
        <div className="text-center mb-24">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-6 py-3 mb-8 shadow-sm animate-fade-in">
            <Star className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">Trusted by 1,200+ investors worldwide</span>
          </div>
          
          <h2 className="text-5xl md:text-7xl font-bold mb-8 text-gray-900 leading-tight animate-slide-up">
            Fractionalize Land Assets
          </h2>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed animate-fade-in delay-300">
            Revolutionize land ownership through blockchain technology. 
            Tokenize, trade, and democratize real estate investments with transparent, secure smart contracts.
          </p>
          
          {!isConnected && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in delay-500">
              <WalletConnect />
              <Button variant="outline" size="xl" className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setIsLearnMoreOpen(true)}>
                Learn More
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Enhanced Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {features.map((feature, index) => (
            <Card key={index} className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 group animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <div className="text-gray-700">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{feature.description}</p>
                <ul className="space-y-2 text-left">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-gray-700" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enhanced Stats Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          <div className="stats-card text-center bg-white border-gray-200">
            <div className="text-5xl font-bold text-gray-900 mb-3">$10M+</div>
            <div className="text-gray-600 text-lg">Total Value Locked</div>
            <div className="text-sm text-gray-500 mt-2">Growing steadily</div>
          </div>
          <div className="stats-card text-center bg-white border-gray-200">
            <div className="text-5xl font-bold text-gray-900 mb-3">500+</div>
            <div className="text-gray-600 text-lg">Land Parcels Tokenized</div>
            <div className="text-sm text-gray-500 mt-2">Across 12 countries</div>
          </div>
          <div className="stats-card text-center bg-white border-gray-200">
            <div className="text-5xl font-bold text-gray-900 mb-3">1,200+</div>
            <div className="text-gray-600 text-lg">Active Investors</div>
            <div className="text-sm text-gray-500 mt-2">From 45 countries</div>
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="mb-24">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">What Our Users Say</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-white border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 200}ms` }}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-gray-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-4 italic">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Enhanced Call to Action */}
        <div className="text-center">
          <Card className="bg-white border-gray-200 shadow-lg max-w-4xl mx-auto animate-fade-in delay-700">
            <CardContent className="p-12">
              <h3 className="text-3xl font-bold mb-6 text-gray-900">Ready to Start Your Investment Journey?</h3>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Connect your wallet to access the most advanced land fractionalization platform. 
                Start building your real estate portfolio today with as little as $50.
              </p>
              {!isConnected && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <WalletConnect />
                  <Button variant="outline" size="xl" className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50">
                    View Documentation
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Learn More Modal */}
      <Dialog open={isLearnMoreOpen} onOpenChange={setIsLearnMoreOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Layers className="w-5 h-5" />
              Understanding Fractionalization of Land Assets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-gray-700">
            <p>
              Fractionalization divides a single piece of real estate into smaller, affordable digital units, or tokens. Each token
              represents a fractional share of ownership recorded securely on a blockchain.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-gray-900 font-semibold">
                  <FileText className="w-4 h-4" />
                  Tokenization
                </div>
                <p className="text-sm">
                  Convert a physical asset (land) into digital tokens. Each token is like a share that represents a portion of the property.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-gray-900 font-semibold">
                  <Lock className="w-4 h-4" />
                  Blockchain Technology
                </div>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li><span className="font-medium">Transparency</span>: Public ledger visible to everyone.</li>
                  <li><span className="font-medium">Security</span>: Decentralized and resistant to fraud.</li>
                  <li><span className="font-medium">Immutability</span>: Records are permanent and tamper-proof.</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-gray-900 font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Smart Contracts
                </div>
                <p className="text-sm">
                  Self-executing code automates buying, selling, and distribution of income to token holders without intermediaries.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-white border border-gray-200">
              <div className="font-semibold text-gray-900 mb-2">Benefits for Investors</div>
              <ul className="text-sm grid md:grid-cols-2 gap-2">
                <li className="flex items-start gap-2"><TrendingUp className="w-4 h-4 mt-0.5" /> Increased Liquidity: Trade fractions faster than whole properties.</li>
                <li className="flex items-start gap-2"><Users className="w-4 h-4 mt-0.5" /> Diversification: Own small shares across many properties.</li>
                <li className="flex items-start gap-2"><Landmark className="w-4 h-4 mt-0.5" /> Reduced Barriers: Invest with smaller amounts.</li>
                <li className="flex items-start gap-2"><Globe className="w-4 h-4 mt-0.5" /> Global Access: Participate from anywhere in the world.</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-white border border-gray-200">
              <div className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ListOrdered className="w-4 h-4" />
                How It Works: Step-by-Step
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Asset Vetting: Identify a valuable piece of land.</li>
                <li>Legal Structuring: Set up documents and an SPV to hold the asset.</li>
                <li>Token Creation: Mint a fixed number of tokens on the blockchain.</li>
                <li>Token Sale: Offer tokens to investors for crypto or fiat.</li>
                <li>Ongoing Management: Smart contracts distribute income to holders.</li>
              </ol>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPage;