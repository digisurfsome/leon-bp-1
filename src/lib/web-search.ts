export interface SearchResult {
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

/**
 * Performs a web search using the configured provider
 */
export async function webSearch(query: string): Promise<SearchResult> {
  const apiKey = process.env.WEB_SEARCH_API_KEY;
  const provider = process.env.WEB_SEARCH_PROVIDER || "tavily";

  if (!apiKey) {
    console.error("WEB_SEARCH_API_KEY is not configured");
    return {
      summary: "Web search is not configured. Missing API key.",
      sources: [],
    };
  }

  try {
    if (provider === "tavily") {
      return await searchWithTavily(query, apiKey);
    } else if (provider === "serper") {
      return await searchWithSerper(query, apiKey);
    } else {
      console.error(`Unknown search provider: ${provider}`);
      return {
        summary: `Web search provider "${provider}" is not supported.`,
        sources: [],
      };
    }
  } catch (error) {
    console.error("Web search error:", error);
    return {
      summary: "Web search failed due to an error. Providing answer based on existing knowledge.",
      sources: [],
    };
  }
}

async function searchWithTavily(
  query: string,
  apiKey: string
): Promise<SearchResult> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  const data = await response.json();

  const sources =
    data.results?.map((result: any) => ({
      title: result.title || "Untitled",
      url: result.url,
      snippet: result.content,
    })) || [];

  const summary =
    data.answer ||
    sources.map((s: any) => s.snippet).join(" ") ||
    "No results found.";

  return { summary, sources };
}

async function searchWithSerper(
  query: string,
  apiKey: string
): Promise<SearchResult> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();

  const sources =
    data.organic?.map((result: any) => ({
      title: result.title || "Untitled",
      url: result.link,
      snippet: result.snippet,
    })) || [];

  const summary =
    sources.map((s: any) => s.snippet).join(" ") || "No results found.";

  return { summary, sources };
}
