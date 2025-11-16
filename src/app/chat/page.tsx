"use client";

import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/auth/user-profile";
import { useSession } from "@/lib/auth-client";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

// Markdown components
const H1: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = (props) => (
  <h1 className="mt-2 mb-3 text-2xl font-bold" {...props} />
);
const H2: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = (props) => (
  <h2 className="mt-2 mb-2 text-xl font-semibold" {...props} />
);
const H3: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = (props) => (
  <h3 className="mt-2 mb-2 text-lg font-semibold" {...props} />
);
const Paragraph: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = (
  props
) => <p className="mb-3 leading-7 text-sm" {...props} />;
const UL: React.FC<React.HTMLAttributes<HTMLUListElement>> = (props) => (
  <ul className="mb-3 ml-5 list-disc space-y-1 text-sm" {...props} />
);
const OL: React.FC<React.OlHTMLAttributes<HTMLOListElement>> = (props) => (
  <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm" {...props} />
);
const LI: React.FC<React.LiHTMLAttributes<HTMLLIElement>> = (props) => (
  <li className="leading-6" {...props} />
);
const Anchor: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = (
  props
) => (
  <a
    className="underline underline-offset-2 text-primary hover:opacity-90"
    target="_blank"
    rel="noreferrer noopener"
    {...props}
  />
);
const Blockquote: React.FC<React.BlockquoteHTMLAttributes<HTMLElement>> = (
  props
) => (
  <blockquote
    className="mb-3 border-l-2 border-border pl-3 text-muted-foreground"
    {...props}
  />
);
const Code: Components["code"] = ({ children, className, ...props }) => {
  const match = /language-(\w+)/.exec(className || "");
  const isInline = !match;

  if (isInline) {
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-xs" {...props}>
        {children}
      </code>
    );
  }
  return (
    <pre className="mb-3 w-full overflow-x-auto rounded-md bg-muted p-3">
      <code className="text-xs leading-5" {...props}>
        {children}
      </code>
    </pre>
  );
};
const HR: React.FC<React.HTMLAttributes<HTMLHRElement>> = (props) => (
  <hr className="my-4 border-border" {...props} />
);
const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = (
  props
) => (
  <div className="mb-3 overflow-x-auto">
    <table className="w-full border-collapse text-sm" {...props} />
  </div>
);
const TH: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <th
    className="border border-border bg-muted px-2 py-1 text-left"
    {...props}
  />
);
const TD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = (props) => (
  <td className="border border-border px-2 py-1" {...props} />
);

const markdownComponents: Components = {
  h1: H1,
  h2: H2,
  h3: H3,
  p: Paragraph,
  ul: UL,
  ol: OL,
  li: LI,
  a: Anchor,
  blockquote: Blockquote,
  code: Code,
  hr: HR,
  table: Table,
  th: TH,
  td: TD,
};

// Types
interface ModelPreset {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
}

interface PersonaPreset {
  id: string;
  name: string;
  systemPrompt: string;
  description: string | null;
  isActive: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelKey?: string | null;
  personaKey?: string | null;
  variantGroupId?: string | null;
  latencyMs?: number | null;
  tokensTotal?: number | null;
  createdAt: string | Date;
}

interface ChatSession {
  id: string;
  title: string | null;
  messageCount?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface ChatConfig {
  models: ModelPreset[];
  personas: PersonaPreset[];
}

export default function ChatPage() {
  const { data: session, isPending } = useSession();
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Fetch config on mount
  useEffect(() => {
    if (session?.user) {
      fetchConfig();
      fetchSessions();
    }
  }, [session]);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/chat/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // Set default selected model if available
        if (data.userSettings?.defaultModelKey) {
          setSelectedModels([data.userSettings.defaultModelKey]);
        } else if (data.models.length > 0) {
          setSelectedModels([data.models[0].id]);
        }
        if (data.userSettings?.defaultPersonaKey) {
          setSelectedPersona(data.userSettings.defaultPersonaKey);
        }
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  }

  async function loadSession(sessionId: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error("Failed to load session:", error);
    }
  }

  async function sendMessage() {
    if (!input.trim() || selectedModels.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: input,
          modelKeys: selectedModels,
          personaKey: selectedPersona,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Update session ID if this was a new session
        if (!currentSessionId) {
          setCurrentSessionId(data.sessionId);
          fetchSessions(); // Refresh session list
        }

        // Add user message and all replies to messages
        setMessages((prev) => [
          ...prev,
          data.userMessage,
          ...data.replies,
        ]);

        setInput("");
      } else {
        console.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleModel(modelId: string) {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  }

  function startNewChat() {
    setCurrentSessionId(null);
    setMessages([]);
  }

  // Group messages by variant group for display
  function groupMessagesByVariant(msgs: ChatMessage[]) {
    const grouped: Array<{
      userMessage?: ChatMessage;
      assistantMessages: ChatMessage[];
    }> = [];

    for (const msg of msgs) {
      if (msg.role === "user") {
        grouped.push({
          userMessage: msg,
          assistantMessages: [],
        });
      } else if (msg.role === "assistant") {
        // Find the corresponding user message group
        const lastGroup = grouped[grouped.length - 1];
        if (lastGroup) {
          lastGroup.assistantMessages.push(msg);
        }
      }
    }

    return grouped;
  }

  if (isPending) {
    return <div className="container mx-auto px-4 py-12">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <UserProfile />
        </div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByVariant(messages);

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <Button onClick={startNewChat} className="w-full">
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
              Recent Sessions
            </div>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left p-2 rounded mb-1 text-sm hover:bg-muted ${
                  currentSessionId === s.id ? "bg-muted" : ""
                }`}
              >
                <div className="truncate">
                  {s.title || "Untitled Chat"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.messageCount || 0} messages
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                {showSidebar ? "Hide" : "Show"} Sidebar
              </Button>
              <h1 className="text-xl font-bold">Multi-Model Chat</h1>
            </div>
            <span className="text-sm text-muted-foreground">
              {session.user.name}
            </span>
          </div>

          {/* Model selector */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium">Select Models:</span>
            {config?.models.map((model) => (
              <button
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  selectedModels.includes(model.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {model.displayName}
              </button>
            ))}
          </div>

          {/* Persona selector (optional) */}
          {config?.personas && config.personas.length > 0 && (
            <div className="flex gap-2 mt-2">
              <span className="text-sm font-medium">Persona:</span>
              <select
                value={selectedPersona || ""}
                onChange={(e) => setSelectedPersona(e.target.value || null)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="">Default</option>
                {config.personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {groupedMessages.length === 0 && (
            <div className="text-center text-muted-foreground mt-8">
              Select models and start a conversation
            </div>
          )}

          {groupedMessages.map((group, idx) => (
            <div key={idx} className="space-y-3">
              {/* User message */}
              {group.userMessage && (
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-[80%]">
                    <div className="text-sm font-medium mb-1">You</div>
                    <ReactMarkdown components={markdownComponents}>
                      {group.userMessage.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Assistant messages (one per model) */}
              <div className="space-y-2">
                {group.assistantMessages.map((msg) => {
                  const model = config?.models.find((m) => m.id === msg.modelKey);
                  return (
                    <div key={msg.id} className="bg-muted p-3 rounded-lg max-w-[90%]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">
                          {model?.displayName || "AI"}
                        </div>
                        {msg.latencyMs && msg.tokensTotal && (
                          <div className="text-xs text-muted-foreground">
                            {msg.latencyMs}ms · {msg.tokensTotal} tok
                          </div>
                        )}
                      </div>
                      <ReactMarkdown components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="text-center text-muted-foreground">
              Getting responses from {selectedModels.length} model(s)...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || selectedModels.length === 0}
              className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || selectedModels.length === 0}
            >
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </form>
          {selectedModels.length === 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Please select at least one model
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
