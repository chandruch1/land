import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractAddress, ipfsHash } = await req.json();
    
    const pinataJWT = Deno.env.get('PINATA_JWT');
    if (!pinataJWT) {
      throw new Error('PINATA_JWT not configured');
    }

    let metadataUrl = '';
    let fetchResponse;

    // If IPFS hash is provided, fetch directly
    if (ipfsHash) {
      metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
      fetchResponse = await fetch(metadataUrl);
    } else if (contractAddress) {
      // Search for metadata by contract address in Pinata
      const searchResponse = await fetch('https://api.pinata.cloud/data/pinList', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pinataJWT}`,
          'Content-Type': 'application/json',
        },
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search Pinata: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      
      // Find files that match the contract address in metadata
      const matchingFile = searchData.rows?.find((file: any) => 
        file.metadata?.keyvalues?.contractAddress === contractAddress ||
        file.metadata?.name?.includes(contractAddress)
      );

      if (!matchingFile) {
        return new Response(
          JSON.stringify({ 
            error: 'No metadata found for contract address',
            contractAddress 
          }), 
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      metadataUrl = `https://gateway.pinata.cloud/ipfs/${matchingFile.ipfs_pin_hash}`;
      fetchResponse = await fetch(metadataUrl);
    } else {
      throw new Error('Either contractAddress or ipfsHash must be provided');
    }

    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch metadata: ${fetchResponse.statusText}`);
    }

    const metadata = await fetchResponse.json();

    console.log('Successfully fetched metadata for:', contractAddress || ipfsHash);

    return new Response(
      JSON.stringify({ 
        success: true,
        metadata,
        ipfsUrl: metadataUrl,
        contractAddress
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in fetch-pinata-metadata function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});