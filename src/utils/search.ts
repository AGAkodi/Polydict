import { fetchHttp1 } from './polymarket';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Execute a web search query on DuckDuckGo using HTTP/1.1 to bypass SSL ALPN issues,
 * and parse results via regular expression matching.
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const html = await fetchHttp1(url);

    const results: SearchResult[] = [];
    
    // Split content by result blocks
    const resultBlocks = html.split(/<div class="[^"]*web-result[^"]*">/);
    
    // Skip the first block (everything before the first result item)
    for (let i = 1; i < resultBlocks.length && results.length < 5; i++) {
      const block = resultBlocks[i].split(/<\/div>\s*<\/div>/)[0]; // Narrow down to the end of result container
      
      // Extract title and URL
      const urlMatch = block.match(/<a class="result__url"[^>]*href="([^"]+)"/);
      const titleMatch = block.match(/<a class="result__url"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      
      if (urlMatch && titleMatch) {
        let title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        let resultUrl = urlMatch[1];
        
        // Unescape DDG tracking redirect link structure
        if (resultUrl.startsWith('//')) {
          resultUrl = 'https:' + resultUrl;
        }
        if (resultUrl.includes('uddg=')) {
          const parts = resultUrl.split('uddg=');
          if (parts[1]) {
            resultUrl = decodeURIComponent(parts[1].split('&')[0]);
          }
        }
        
        title = unescapeHtml(title);
        snippet = unescapeHtml(snippet);

        if (title && resultUrl) {
          results.push({
            title,
            snippet,
            url: resultUrl,
          });
        }
      }
    }
    
    return results;
  } catch (err) {
    console.error('Web search failed:', err);
    return [];
  }
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&bull;/g, '•');
}
