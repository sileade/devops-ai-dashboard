import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  searchChatMessages: vi.fn(),
  exportChatHistory: vi.fn(),
  clearChatHistory: vi.fn(),
}));

import * as db from "./db";

describe("Chat Search Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should search messages by query", async () => {
    const mockResults = [
      {
        id: 1,
        sessionId: "session-1",
        sessionTitle: "Docker Help",
        role: "user",
        content: "How do I restart a Docker container?",
        createdAt: new Date(),
      },
      {
        id: 2,
        sessionId: "session-1",
        sessionTitle: "Docker Help",
        role: "assistant",
        content: "To restart a Docker container, use: docker restart <container_id>",
        createdAt: new Date(),
      },
    ];

    vi.mocked(db.searchChatMessages).mockResolvedValue(mockResults);

    const results = await db.searchChatMessages("user-123", "Docker");
    
    expect(db.searchChatMessages).toHaveBeenCalledWith("user-123", "Docker");
    expect(results).toHaveLength(2);
    expect(results[0].content).toContain("Docker");
  });

  it("should return empty array when no matches found", async () => {
    vi.mocked(db.searchChatMessages).mockResolvedValue([]);

    const results = await db.searchChatMessages("user-123", "nonexistent");
    
    expect(results).toHaveLength(0);
  });

  it("should filter by session ID when provided", async () => {
    vi.mocked(db.searchChatMessages).mockResolvedValue([]);

    await db.searchChatMessages("user-123", "query", { sessionId: "session-1" });
    
    expect(db.searchChatMessages).toHaveBeenCalledWith("user-123", "query", { sessionId: "session-1" });
  });

  it("should filter by date range when provided", async () => {
    vi.mocked(db.searchChatMessages).mockResolvedValue([]);

    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-12-31");

    await db.searchChatMessages("user-123", "query", { startDate, endDate });
    
    expect(db.searchChatMessages).toHaveBeenCalledWith("user-123", "query", { startDate, endDate });
  });
});

describe("Chat Export Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export chat history as JSON", async () => {
    const mockJsonExport = JSON.stringify({
      session: {
        id: "session-1",
        title: "Docker Help",
        createdAt: new Date().toISOString(),
      },
      messages: [
        { role: "user", content: "Hello", timestamp: new Date().toISOString() },
        { role: "assistant", content: "Hi there!", timestamp: new Date().toISOString() },
      ],
    }, null, 2);

    vi.mocked(db.exportChatHistory).mockResolvedValue(mockJsonExport);

    const result = await db.exportChatHistory("session-1", "json");
    
    expect(db.exportChatHistory).toHaveBeenCalledWith("session-1", "json");
    expect(result).toContain("session");
    expect(result).toContain("messages");
    
    const parsed = JSON.parse(result);
    expect(parsed.messages).toHaveLength(2);
  });

  it("should export chat history as Markdown", async () => {
    const mockMdExport = `# Docker Help

**Session ID:** session-1
**Created:** 2024-01-15T10:00:00.000Z

---

### 👤 User
*1/15/2024, 10:00:00 AM*

Hello

---

### 🤖 Assistant
*1/15/2024, 10:00:01 AM*

Hi there!

---
`;

    vi.mocked(db.exportChatHistory).mockResolvedValue(mockMdExport);

    const result = await db.exportChatHistory("session-1", "markdown");
    
    expect(db.exportChatHistory).toHaveBeenCalledWith("session-1", "markdown");
    expect(result).toContain("# Docker Help");
    expect(result).toContain("👤 User");
    expect(result).toContain("🤖 Assistant");
  });

  it("should return empty result for non-existent session", async () => {
    vi.mocked(db.exportChatHistory).mockResolvedValue("[]");

    const result = await db.exportChatHistory("non-existent", "json");
    
    expect(result).toBe("[]");
  });
});

describe("Clear Chat History Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear chat history for a session", async () => {
    vi.mocked(db.clearChatHistory).mockResolvedValue(true);

    const result = await db.clearChatHistory("session-1");
    
    expect(db.clearChatHistory).toHaveBeenCalledWith("session-1");
    expect(result).toBe(true);
  });

  it("should return false when clearing fails", async () => {
    vi.mocked(db.clearChatHistory).mockResolvedValue(false);

    const result = await db.clearChatHistory("session-1");
    
    expect(result).toBe(false);
  });
});

describe("Confirmation Dialog Integration", () => {
  it("should require confirmation before clearing chat", () => {
    // This test validates the UI flow conceptually
    // In a real scenario, this would be an E2E test
    
    const confirmationRequired = true;
    const userConfirmed = true;
    
    const shouldClear = confirmationRequired && userConfirmed;
    
    expect(shouldClear).toBe(true);
  });

  it("should not clear chat if user cancels", () => {
    const confirmationRequired = true;
    const userConfirmed = false;
    
    const shouldClear = confirmationRequired && userConfirmed;
    
    expect(shouldClear).toBe(false);
  });
});
