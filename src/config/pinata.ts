export interface PinataPinResult {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface PinataMetadataOptions {
  name?: string;
  keyvalues?: Record<string, string>;
}

export async function pinJsonToIPFS(
  content: unknown,
  metadata?: PinataMetadataOptions
): Promise<{ ipfsHash: string; ipfsUrl: string; raw: PinataPinResult }> {
  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error('Missing VITE_PINATA_JWT. Add it to your .env.local');
  }

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: metadata ?? {},
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata error ${res.status}: ${res.statusText} - ${text}`);
  }

  const data = (await res.json()) as PinataPinResult & { IpfsHash: string };
  const ipfsHash = data.IpfsHash;
  const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  return { ipfsHash, ipfsUrl, raw: data };
}

export async function findIpfsHashByContractAddress(
  contractAddress: string
): Promise<string | null> {
  const jwt = import.meta.env.VITE_PINATA_JWT as string | undefined;
  if (!jwt) {
    throw new Error('Missing VITE_PINATA_JWT. Add it to your .env.local');
  }

  const res = await fetch('https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=1000', {
    headers: {
      'Authorization': `Bearer ${jwt}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata list error ${res.status}: ${res.statusText} - ${text}`);
  }

  const json = await res.json();
  const rows: any[] = json.rows ?? [];
  const match = rows.find((row) =>
    row?.metadata?.keyvalues?.contractAddress === contractAddress ||
    row?.metadata?.name?.includes(contractAddress)
  );
  return match?.ipfs_pin_hash ?? null;
}



