import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PinataUploadBody {
  metadata: Record<string, unknown>;
  pinataMetadata?: {
    name?: string;
    keyvalues?: Record<string, string>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pinataJWT = Deno.env.get('PINATA_JWT');
    if (!pinataJWT) {
      throw new Error('PINATA_JWT not configured');
    }

    const { metadata, pinataMetadata } = (await req.json()) as PinataUploadBody;
    if (!metadata || typeof metadata !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing metadata payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinBody = {
      pinataContent: metadata,
      pinataMetadata: pinataMetadata ?? {},
    };

    const pinResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinBody),
    });

    if (!pinResponse.ok) {
      const text = await pinResponse.text();
      throw new Error(`Pinata pin failed: ${pinResponse.status} ${pinResponse.statusText} - ${text}`);
    }

    const result = await pinResponse.json();
    const ipfsHash = result.IpfsHash as string;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    return new Response(
      JSON.stringify({ success: true, ipfsHash, ipfsUrl, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in pinata-upload function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});



