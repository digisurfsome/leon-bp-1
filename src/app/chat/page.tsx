"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { UserProfile } from "@/components/auth/user-profile";
import { useSession } from "@/lib/auth-client";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

// Markdown components (same as before)
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

interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

interface ModelPreset {
  id: string;
  slug: string;
  label: string;
  modelName: string;
}

interface PersonaPreset {
  id: string;
  slug: string;
  label: string;
  description?: string;
}

interface ChatSession {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export default function ChatPage() {
  const { data: session, isPending } = useSession();

  // Config state
  const [models, setModels] = useState<ModelPreset[]>([]);
  const [personas, setPersonas] = useState<PersonaPreset[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");

  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load config on mount
  useEffect(() => {
    if (session?.user) {
      loadConfig();
      loadSessions();
    }
  }, [session]);

  async function loadConfig() {
    try {
      const res = await fetch("/api/chat/config");
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
        setPersonas(data.personas || []);

        // Set defaults from user settings or first item
        if (data.userSettings?.defaultModelPresetId) {
          setSelectedModelId(data.userSettings.defaultModelPresetId);
        } else if (data.models && data.models.length > 0) {
          setSelectedModelId(data.models[0].id);
        }

        if (data.userSettings?.defaultPersonaPresetId) {
          setSelectedPersonaId(data.userSettings.defaultPersonaPresetId);
        } else if (data.personas && data.personas.length > 0) {
          setSelectedPersonaId(data.personas[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  }

  async function loadSessionMessages(sessionId: string) {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error("Failed to load session messages:", error);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    const userMessage: ChatMessage = { role: "user", content: text };

    // Optimistically add user message
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId || undefined,
          messages: [userMessage],
          modelPresetId: selectedModelId || undefined,
          personaPresetId: selectedPersonaId || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Add assistant message
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message.content },
        ]);

        // Update session ID if new
        if (!currentSessionId && data.sessionId) {
          setCurrentSessionId(data.sessionId);
          loadSessions(); // Refresh session list
        }
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || "Failed to send message"}`);
        // Remove optimistic user message on error
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  function startNewChat() {
    setCurrentSessionId(null);
    setMessages([]);
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

  return (
    <div className="flex h-screen">
      {/* Sidebar - Sessions */}
      <div className="w-64 border-r border-border bg-muted/20 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm mb-2">Chat Sessions</h2>
          <Button
            onClick={startNewChat}
            size="sm"
            className="w-full"
            variant="outline"
          >
            + New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No sessions yet
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSessionMessages(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    currentSessionId === s.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="font-medium truncate">
                    {s.title || "New Chat"}
                  </div>
                  <div className="text-xs opacity-70">
                    {s.messageCount || 0} messages
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Model/Persona Pickers */}
        <div className="border-b border-border bg-background p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Model
              </label>
              <Select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                disabled={isLoading}
              >
                <option value="">Select model...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Persona
              </label>
              <Select
                value={selectedPersonaId}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
                disabled={isLoading}
              >
                <option value="">Select persona...</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-end">
              <span className="text-sm text-muted-foreground">
                {session.user.name}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                Start a conversation with AI
              </div>
            )}
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto max-w-[80%]"
                    : "bg-muted max-w-[80%]"
                }`}
              >
                <div className="text-sm font-medium mb-1">
                  {message.role === "user" ? "You" : "AI"}
                </div>
                <div className="text-sm">
                  {message.role === "assistant" ? (
                    <ReactMarkdown components={markdownComponents}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-background p-4">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 p-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
            <Button type="submit" disabled={!input.trim() || isLoading}>
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
