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
  tags?: { id: string; name: string; slug: string; label?: string }[];
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
  tags?: any[];
  image: string;
  icon: string;
  isClobMatched: boolean;
}

// Category Mapping to Gamma API tag parameter (mapped to new keys)
export const CATEGORY_TAG_MAP: Record<string, string | null> = {
  all: null,
  politics: 'politics',
  crypto: 'crypto',
  sports: 'sports',
  economy: 'economy',
  science: 'science',
  culture: 'culture',
  world: 'world',
};

// Display label mappings matching user specification
export const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  politics: 'Politics & Geo-Politics',
  crypto: 'Crypto',
  sports: 'Sports & Esports',
  economy: 'Economy & Finance',
  science: 'Science & Technology',
  culture: 'Culture & Entertainment',
  world: 'World News',
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
 * Fetch markets from Gamma API with high limit (1000) to capture all predictions
 */
export async function fetchGammaMarkets(categoryKey: string = 'all'): Promise<GammaMarket[]> {
  // Always fetch a comprehensive list of the top 1000 active markets globally
  const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1000&order=volume&ascending=false`;

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
 * Advanced keyword/tag classification engine to accurately classify markets server-side with zero category bleed
 */
export function classifyMarket(m: GammaMarket): string {
  const questionLower = (m.question || '').toLowerCase();
  const descLower = (m.description || '').toLowerCase();
  const tagsList = (m.tags || []).map(t => ({
    name: (t.name || '').toLowerCase(),
    slug: (t.slug || '').toLowerCase(),
    label: (t.label || '').toLowerCase()
  }));

  // 1. Crypto Category keywords & tags (First Priority to completely avoid political/crypto bleed)
  const cryptoKeywords = [
    'crypto', 'bitcoin', 'btc', 'ether', 'eth', 'solana', 'sol', 'coin', 'token', 
    'doge', 'memecoin', 'stablecoin', 'usdt', 'usdc', 'binance', 'coinbase', 
    'blockchain', 'ethereum', 'cardano', 'ripple', 'xrp', 'litecoin', 'satoshi', 
    'vitalik', 'base chain', 'nft', 'halving', 'defi'
  ];
  const isCrypto = cryptoKeywords.some(kw => questionLower.includes(kw) || descLower.includes(kw)) ||
                   tagsList.some(t => cryptoKeywords.some(kw => t.name.includes(kw) || t.slug.includes(kw) || t.label.includes(kw)));
  if (isCrypto) {
    return CATEGORY_LABELS.crypto;
  }

  // 2. Politics & Geo-Politics Category
  const politicsKeywords = [
    'trump', 'biden', 'harris', 'democrat', 'republican', 'senate', 'house of representatives', 
    'supreme court', 'election', 'presidency', 'president', 'gop', 'white house', 'cabinet', 
    'parliament', 'prime minister', 'putin', 'zelensky', 'netanyahu', 'xi jinping', 'diplomacy', 
    'treaty', 'sanctions', 'geopolitics', 'geo-politics', 'foreign policy', 'nato', 'un ', 
    'united nations', 'taiwan', 'gaza', 'ukraine', 'israel', 'palestine', 'iran', 'north korea', 
    'nuclear', 'tariff', 'border patrol', 'immigration', 'congress', 'governorship', 'governor', 
    'mayor', 'political', 'referendum', 'impeachment', 'debates', 'vp nominee', 'vance', 'walz'
  ];
  const isPolitics = politicsKeywords.some(kw => questionLower.includes(kw) || descLower.includes(kw)) ||
                     tagsList.some(t => t.name.includes('politic') || t.slug.includes('politic') || t.label.includes('politic') ||
                                        t.name.includes('elect') || t.slug.includes('elect') || t.label.includes('elect') ||
                                        politicsKeywords.some(kw => t.name.includes(kw) || t.slug.includes(kw) || t.label.includes(kw)));
  if (isPolitics) {
    return CATEGORY_LABELS.politics;
  }

  // 3. Sports & Esports Category
  const sportsKeywords = [
    'sports', 'nfl', 'nba', 'mlb', 'nhl', 'fifa', 'premier league', 'champions league', 
    'world cup', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 
    'ufc', 'mma', 'boxing', 'olympics', 'super bowl', 'formula 1', 'f1', 'golf', 
    'cricket', 'rugby', 'esports', 'twitch', 'league of legends', 'dota', 'counter-strike', 
    'csgo', 'cs2', 'valorant', 'fortnite', 'starcraft', 'overwatch', 'vct', 'faker', 's1mple'
  ];
  const isSports = sportsKeywords.some(kw => questionLower.includes(kw) || descLower.includes(kw)) ||
                   tagsList.some(t => t.name.includes('sport') || t.slug.includes('sport') || t.label.includes('sport') ||
                                      t.name.includes('esport') || t.slug.includes('esport') || t.label.includes('esport') ||
                                      t.name.includes('gaming') || t.slug.includes('gaming') || t.label.includes('gaming') ||
                                      sportsKeywords.some(kw => t.name.includes(kw) || t.slug.includes(kw) || t.label.includes(kw)));
  if (isSports) {
    return CATEGORY_LABELS.sports;
  }

  // 4. Economy & Finance Category
  const economyKeywords = [
    'economy', 'finance', 'fed ', 'federal reserve', 'interest rate', 'inflation', 'cpi', 
    'gdp', 'recession', 'jobs report', 'unemployment', 'stocks', 'stock market', 'nasdaq', 
    's&p 500', 'dow jones', 'spx', 'market cap', 'ipo', 'bankruptcy', 'acquisition', 
    'merger', 'bond yield', 'interest rates', 'treasury', 'powell', 'sec ', 'sec-regulated', 
    'gold ', 'silver ', 'commodity', 'oil price', 'gas price', 'housing market'
  ];
  const isEconomy = economyKeywords.some(kw => questionLower.includes(kw) || descLower.includes(kw)) ||
                    tagsList.some(t => t.name.includes('econom') || t.slug.includes('econom') || t.label.includes('econom') ||
                                       t.name.includes('financ') || t.slug.includes('financ') || t.label.includes('financ') ||
                                       t.name.includes('business') || t.slug.includes('business') || t.label.includes('business') ||
                                       t.name.includes('stock') || t.slug.includes('stock') || t.label.includes('stock') ||
                                       economyKeywords.some(kw => t.name.includes(kw) || t.slug.includes(kw) || t.label.includes(kw)));
  if (isEconomy) {
    return CATEGORY_LABELS.economy;
  }

  // 5. Science & Technology Category
  const scienceKeywords = [
    'science', 'technology', 'tech', 'ai', 'artificial intelligence', 'gpt', 'openai', 
    'claude', 'gemini', 'nvidia', 'gpu', 'llama', 'meta', 'apple', 'google', 'microsoft', 
    'spacex', 'nasa', 'mars', 'rocket', 'spaceflight', 'fusion', 'quantum', 'supercomputer', 
    'cancer', 'vaccine', 'fda approval', 'climate change', 'electric vehicle', 'tesla', 
    'cybersecurity', 'hacker', 'software', 'hardware', 'silicon', 'semiconductor', 'telecom'
  ];
  const isScience = scienceKeywords.some(kw => questionLower.includes(kw) || descLower.includes(kw)) ||
                    tagsList.some(t => t.name.includes('science') || t.slug.includes('science') || t.label.includes('science') ||
                                       t.name.includes('tech') || t.slug.includes('tech') || t.label.includes('tech') ||
                                       t.name.includes('ai') || t.slug.includes('ai') || t.label.includes('ai') ||
                                       t.name.includes('space') || t.slug.includes('space') || t.label.includes('space') ||
                                       scienceKeywords.some(kw => t.name.includes(kw) || t.slug.includes(kw) || t.label.includes(kw)));
  if (isScience) {
    return CATEGORY_LABELS.science;
  }

  // 6. Culture & Entertainment Category
  const cultureKeywords = [
    'culture', 'entertainment', 'oscar', 'academy awards', 'grammy', 'emmy', 'hollywood', 
    'movie', 'film', 'box office', 'netflix', 'celebrity', 'taylor swift', 'kanye', 'elon musk', 
    'mrbeast', 'youtube', 'streamer', 'tiktok', 'album', 'billboard', 'rap ', 'pop music', 
    'met gala', 'fashion', 'superbowl halftime', 'drake', 'kendrick', 'grand theft auto', 'gta 6', 
    'award'
  ];
  const isCulture = cultureKeywords.some(kw => questionLower.includes(kw) || descLower.includes(kw)) ||
                    tagsList.some(t => t.name.includes('cultur') || t.slug.includes('cultur') || t.label.includes('cultur') ||
                                       t.name.includes('pop') || t.slug.includes('pop') || t.label.includes('pop') ||
                                       t.name.includes('entertainment') || t.slug.includes('entertainment') || t.label.includes('entertainment') ||
                                       t.name.includes('movie') || t.slug.includes('movie') || t.label.includes('movie') ||
                                       t.name.includes('music') || t.slug.includes('music') || t.label.includes('music') ||
                                       cultureKeywords.some(kw => t.name.includes(kw) || t.slug.includes(kw) || t.label.includes(kw)));
  if (isCulture) {
    return CATEGORY_LABELS.culture;
  }

  // 7. World News Category
  const worldKeywords = [
    'world news', 'disaster', 'earthquake', 'hurricane', 'tsunami', 'wildfire', 'pandemic', 
    'epidemic', 'who ', 'weather', 'global warming', 'protest', 'strike', 'court case', 
    'verdict', 'trial', 'royal family', 'king charles', 'pope', 'unemployment rate', 
    'census', 'crime', 'aviation', 'crash', 'shipwreck', 'space debris', 'world'
  ];
  const isWorld = worldKeywords.some(kw => questionLower.includes(kw) || descLower.includes(kw)) ||
                  tagsList.some(t => t.name.includes('world') || t.slug.includes('world') || t.label.includes('world') ||
                                     t.name.includes('news') || t.slug.includes('news') || t.label.includes('news') ||
                                     worldKeywords.some(kw => t.name.includes(kw) || t.slug.includes(kw) || t.label.includes(kw)));
  if (isWorld) {
    return CATEGORY_LABELS.world;
  }

  // Fallback to World News
  return CATEGORY_LABELS.world;
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
      category: classifyMarket(gamma),
      tags: gamma.tags || [],
      image: gamma.image || '',
      icon: gamma.icon || '',
      isClobMatched,
    });
  }

  // Handle legacy keys mapping for safety
  let activeKey = categoryKey.toLowerCase();
  if (activeKey === 'elections') activeKey = 'politics';
  if (activeKey === 'ai') activeKey = 'science';
  if (activeKey === 'finance' || activeKey === 'economics') activeKey = 'economy';

  if (activeKey !== 'all') {
    const targetLabel = CATEGORY_LABELS[activeKey];
    if (targetLabel) {
      return mergedList.filter(m => m.category === targetLabel).sort((a, b) => b.volume - a.volume);
    }
  }

  // Sort by volume descending
  return mergedList.sort((a, b) => b.volume - a.volume);
}
