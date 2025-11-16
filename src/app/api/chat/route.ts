import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { webSearch } from "@/lib/web-search";

export async function POST(req: Request) {
  const {
    messages,
    useWeb,
  }: { messages: UIMessage[]; useWeb?: boolean } = await req.json();

  let enhancedMessages = [...messages];
  let searchSources: Array<{ title: string; url: string }> | undefined;

  // If web search is enabled, fetch results and inject into context
  if (useWeb && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    const query =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : lastMessage.parts?.find((p: any) => p.type === "text")?.text || "";

    if (query) {
      const searchResults = await webSearch(query);
      searchSources = searchResults.sources.map((s) => ({
        title: s.title,
        url: s.url,
      }));

      // Inject search results as a system message
      const searchContext = {
        role: "system" as const,
        content: `You have access to recent web search results for the user's query. Use this information to provide an accurate, up-to-date answer.

Search Results:
${searchResults.summary}

Sources:
${searchResults.sources.map((s, i) => `${i + 1}. ${s.title}\n   URL: ${s.url}\n   ${s.snippet || ""}`).join("\n\n")}

Please cite these sources when relevant in your response.`,
      };

      enhancedMessages = [
        ...messages.slice(0, -1),
        searchContext,
        messages[messages.length - 1],
      ];
    }
  }

  const result = streamText({
    model: openai(process.env.OPENAI_MODEL || "gpt-4o-mini"),
    messages: convertToModelMessages(enhancedMessages),
  });

  return (
    result as unknown as { toUIMessageStreamResponse: () => Response }
  ).toUIMessageStreamResponse();
}
