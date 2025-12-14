import axios from 'axios';

interface PriceCache {
  price: number;
  timestamp: number;
}

let priceCache: PriceCache | null = null;
const CACHE_DURATION = 60 * 1000; // 1 minute

/**
 * Fetch current BTC/USD price from CoinGecko API
 * Uses caching to avoid rate limits
 */
export async function getBitcoinPrice(): Promise<number> {
  const now = Date.now();
  
  // Return cached price if still valid
  if (priceCache && (now - priceCache.timestamp) < CACHE_DURATION) {
    return priceCache.price;
  }

  try {
    const apiUrl = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
    const response = await axios.get(
      `${apiUrl}/simple/price?ids=bitcoin&vs_currencies=usd`,
      { timeout: 5000 }
    );

    const price = response.data.bitcoin.usd;
    
    if (!price || price <= 0) {
      throw new Error('Invalid price received from API');
    }

    // Update cache
    priceCache = {
      price,
      timestamp: now,
    };

    return price;
  } catch (error: any) {
    // If cache exists, return cached price even if expired
    if (priceCache) {
      console.warn('[bitcoinPrice] API error, using cached price:', error.message);
      return priceCache.price;
    }

    // Fallback to a reasonable default if no cache
    console.error('[bitcoinPrice] Failed to fetch price:', error.message);
    throw new Error('Failed to fetch Bitcoin price');
  }
}

/**
 * Calculate BTC amount for a given USD amount
 */
export async function usdToBtc(usdAmount: number): Promise<number> {
  const btcPrice = await getBitcoinPrice();
  return usdAmount / btcPrice;
}

