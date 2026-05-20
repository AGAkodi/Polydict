import https from 'https';

export interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource?: string;
  endDate?: string;
  endDateIso?: string;
  description?: string;
  outcomes?: string; // Stringified JSON array e.g. '["Yes", "No"]'
  outcomePrices?: string; // Stringified JSON array e.g. '["0.65", "0.35"]'
  volume?: string;
  volumeNum?: number;
  liquidityNum?: number;
  image?: string;
  icon?: string;
  clobTokenIds?: string; // Stringified JSON array of token IDs
  acceptingOrders?: boolean;
}

export interface ClobToken {
  token_id: string;
  outcome: string;
  price: number;
  winner?: boolean;
}

export interface ClobMarket {
  condition_id: string;
  question_id: string;
  question: string;
  description?: string;
  market_slug: string;
  tokens: ClobToken[];
  active?: boolean;
  closed?: boolean;
}

export interface MergedMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  description: string;
  endDate: string;
  endDateIso: string;
  outcomes: string[];
  yesTokenId: string;
  noTokenId: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  category: string;
  image: string;
  icon: string;
  isClobMatched: boolean;
}

// Category Mapping to Gamma API tag parameter
export const CATEGORY_TAG_MAP: Record<string, string | null> = {
  all: null,
  politics: 'politics',
  crypto: 'crypto',
  sports: 'sports',
  science: 'science',
  economics: 'economics',
  culture: 'culture',
  world: 'world',
  ai: 'ai',
  elections: 'elections',
  finance: 'finance',
};

// Display label mappings
export const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  politics: 'Politics',
  crypto: 'Crypto',
  sports: 'Sports',
  science: 'Science & Tech',
  economics: 'Economics',
  culture: 'Culture',
  world: 'World',
  ai: 'AI',
  elections: 'Elections',
  finance: 'Finance',
};

/**
 * Perform a server-side GET fetch using HTTP/1.1 strictly
 * This resolves Node.js internal SSL packet corruption and decryption issues on Windows.
 */
export function fetchHttp1(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      agent: new https.Agent({ keepAlive: true }),
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP Error ${res.statusCode} from ${url}`));
        } else {
          resolve(data);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Fetch markets from Gamma API filtered by category tag
 */
export async function fetchGammaMarkets(categoryKey: string): Promise<GammaMarket[]> {
  const tag = CATEGORY_TAG_MAP[categoryKey.toLowerCase()] || null;
  let url = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume&ascending=false';
  if (tag) {
    url += `&tag=${tag}`;
  }

  const rawData = await fetchHttp1(url);
  const markets = JSON.parse(rawData) as GammaMarket[];
  if (!Array.isArray(markets)) {
    throw new Error(`Gamma API did not return an array: ${rawData.slice(0, 100)}`);
  }
  return markets;
}

/**
 * Fetch markets from CLOB API
 */
export async function fetchClobMarkets(): Promise<ClobMarket[]> {
  const url = 'https://clob.polymarket.com/markets';
  const rawData = await fetchHttp1(url);
  const parsed = JSON.parse(rawData);
  
  if (Array.isArray(parsed)) {
    return parsed as ClobMarket[];
  }
  if (parsed && Array.isArray(parsed.data)) {
    return parsed.data as ClobMarket[];
  }
  
  throw new Error(`CLOB API did not return array data: ${rawData.slice(0, 100)}`);
}

/**
 * Merges Gamma market metadata with live CLOB order book prices.
 * Gracefully throws errors if either endpoint fails to enforce live-only operations.
 */
export async function getMergedMarkets(categoryKey: string = 'all'): Promise<MergedMarket[]> {
  const [gammaMarkets, clobMarkets] = await Promise.all([
    fetchGammaMarkets(categoryKey),
    fetchClobMarkets(),
  ]);

  if (!gammaMarkets || gammaMarkets.length === 0) {
    throw new Error('No markets returned from Polymarket Gamma API.');
  }

  // Create a map of conditionId -> ClobMarket
  const clobMap = new Map<string, ClobMarket>();
  for (const clob of clobMarkets) {
    if (clob.condition_id) {
      clobMap.set(clob.condition_id.toLowerCase(), clob);
    }
  }

  const mergedList: MergedMarket[] = [];

  for (const gamma of gammaMarkets) {
    if (!gamma.conditionId) continue;

    const conditionIdLower = gamma.conditionId.toLowerCase();
    const clobMatch = clobMap.get(conditionIdLower);

    let yesPrice = 0.50;
    let noPrice = 0.50;
    let yesTokenId = '';
    let noTokenId = '';
    let isClobMatched = false;

    // Try parsing from Gamma clobTokenIds
    let yesTokenGamma = '';
    let noTokenGamma = '';
    try {
      if (gamma.clobTokenIds) {
        const parsedTokenIds = JSON.parse(gamma.clobTokenIds) as string[];
        if (parsedTokenIds && parsedTokenIds.length >= 2) {
          yesTokenGamma = parsedTokenIds[0];
          noTokenGamma = parsedTokenIds[1];
        }
      }
    } catch {
      // Ignored
    }

    if (clobMatch && clobMatch.tokens && clobMatch.tokens.length >= 2) {
      isClobMatched = true;
      const yesTokenObj = clobMatch.tokens.find(t => t.outcome.toLowerCase() === 'yes');
      const noTokenObj = clobMatch.tokens.find(t => t.outcome.toLowerCase() === 'no');

      yesTokenId = yesTokenObj?.token_id || yesTokenGamma;
      noTokenId = noTokenObj?.token_id || noTokenGamma;

      yesPrice = yesTokenObj ? yesTokenObj.price : 0.50;
      noPrice = noTokenObj ? noTokenObj.price : 0.50;
    } else {
      // Fallback: Use Gamma outcomePrices
      yesTokenId = yesTokenGamma;
      noTokenId = noTokenGamma;

      try {
        if (gamma.outcomePrices) {
          const parsedPrices = JSON.parse(gamma.outcomePrices) as string[];
          if (parsedPrices && parsedPrices.length >= 2) {
            yesPrice = parseFloat(parsedPrices[0]) || 0.50;
            noPrice = parseFloat(parsedPrices[1]) || 0.50;
          }
        }
      } catch {
        // Default to 0.50
      }
    }

    // Standardize outcome structures
    let outcomeArray: string[] = ['Yes', 'No'];
    try {
      if (gamma.outcomes) {
        outcomeArray = JSON.parse(gamma.outcomes) as string[];
      }
    } catch {
      // Keep default
    }

    mergedList.push({
      id: gamma.id,
      question: gamma.question,
      conditionId: gamma.conditionId,
      slug: gamma.slug,
      description: gamma.description || '',
      endDate: gamma.endDate || '',
      endDateIso: gamma.endDateIso || '',
      outcomes: outcomeArray,
      yesTokenId,
      noTokenId,
      yesPrice,
      noPrice,
      volume: gamma.volumeNum || (gamma.volume ? parseFloat(gamma.volume) : 0),
      liquidity: gamma.liquidityNum || 0,
      category: CATEGORY_LABELS[categoryKey.toLowerCase()] || 'All',
      image: gamma.image || '',
      icon: gamma.icon || '',
      isClobMatched,
    });
  }

  // Sort by volume descending
  return mergedList.sort((a, b) => b.volume - a.volume);
}
