import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, chatMessages, chatSessions, InsertChatMessage, InsertChatSession } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// Chat History Functions
// ============================================

// Get or create a chat session for a user
export async function getOrCreateChatSession(userOpenId: string | null, sessionId?: string): Promise<{ sessionId: string; conversationId: number; isNew: boolean }> {
  const db = await getDb();
  if (!db) {
    // Return a temporary session ID if DB is not available
    const tempSessionId = sessionId || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return { sessionId: tempSessionId, conversationId: 0, isNew: true };
  }

  try {
    // If sessionId provided, try to find it
    if (sessionId) {
      const existing = await db.select().from(chatSessions)
        .where(eq(chatSessions.sessionId, sessionId))
        .limit(1);
      
      if (existing.length > 0) {
        return { sessionId: existing[0].sessionId, conversationId: existing[0].id, isNew: false };
      }
    }

    // Find active session for user
    if (userOpenId) {
      const activeSession = await db.select().from(chatSessions)
        .where(and(
          eq(chatSessions.userOpenId, userOpenId),
          eq(chatSessions.isActive, true)
        ))
        .orderBy(desc(chatSessions.updatedAt))
        .limit(1);

      if (activeSession.length > 0) {
        return { sessionId: activeSession[0].sessionId, conversationId: activeSession[0].id, isNew: false };
      }
    }

    // Create new session
    const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId: userOpenId,
      title: "New Chat",
      isActive: true,
    });

    return { sessionId: newSessionId, conversationId: result[0].insertId, isNew: true };
  } catch (error) {
    console.error("[Database] Failed to get/create chat session:", error);
    const fallbackId = `fallback-${Date.now()}`;
    return { sessionId: fallbackId, conversationId: 0, isNew: true };
  }
}

// Save a chat message
export async function saveChatMessage(message: {
  conversationId: number;
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: string[];
  commands?: { command: string; description: string }[];
}): Promise<number | null> {
  const db = await getDb();
  if (!db || message.conversationId === 0) {
    console.warn("[Database] Cannot save chat message: database not available or invalid conversationId");
    return null;
  }

  try {
    const result = await db.insert(chatMessages).values({
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      suggestions: message.suggestions,
      commands: message.commands,
    });
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to save chat message:", error);
    return null;
  }
}

// Get chat history for a session by conversationId
export async function getChatHistory(conversationId: number, limit: number = 100): Promise<typeof chatMessages.$inferSelect[]> {
  const db = await getDb();
  if (!db || conversationId === 0) {
    console.warn("[Database] Cannot get chat history: database not available or invalid conversationId");
    return [];
  }

  try {
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);

    return messages;
  } catch (error) {
    console.error("[Database] Failed to get chat history:", error);
    return [];
  }
}

// Get chat history by sessionId (string)
export async function getChatHistoryBySessionId(sessionId: string, limit: number = 100): Promise<typeof chatMessages.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    return [];
  }

  try {
    // First find the session
    const session = await db.select().from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    if (session.length === 0) {
      return [];
    }

    return getChatHistory(session[0].id, limit);
  } catch (error) {
    console.error("[Database] Failed to get chat history by sessionId:", error);
    return [];
  }
}

// Get all chat sessions for a user
export async function getUserChatSessions(userOpenId: string): Promise<typeof chatSessions.$inferSelect[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get chat sessions: database not available");
    return [];
  }

  try {
    const sessions = await db.select().from(chatSessions)
      .where(eq(chatSessions.userOpenId, userOpenId))
      .orderBy(desc(chatSessions.updatedAt));

    return sessions;
  } catch (error) {
    console.error("[Database] Failed to get chat sessions:", error);
    return [];
  }
}

// Update message feedback
export async function updateMessageFeedback(messageId: number, feedback: "positive" | "negative"): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update feedback: database not available");
    return false;
  }

  try {
    await db.update(chatMessages)
      .set({ feedback })
      .where(eq(chatMessages.id, messageId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update feedback:", error);
    return false;
  }
}

// Clear chat history for a session
export async function clearChatHistory(sessionId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot clear chat history: database not available");
    return false;
  }

  try {
    // Find the session first
    const session = await db.select().from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    if (session.length > 0) {
      await db.delete(chatMessages).where(eq(chatMessages.conversationId, session[0].id));
    }
    return true;
  } catch (error) {
    console.error("[Database] Failed to clear chat history:", error);
    return false;
  }
}

// Create a new chat session
export async function createNewChatSession(userOpenId: string | null): Promise<{ sessionId: string; conversationId: number }> {
  const db = await getDb();
  const newSessionId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  if (!db) {
    return { sessionId: newSessionId, conversationId: 0 };
  }

  try {
    // Deactivate previous sessions
    if (userOpenId) {
      await db.update(chatSessions)
        .set({ isActive: false })
        .where(eq(chatSessions.userOpenId, userOpenId));
    }

    // Create new session
    const result = await db.insert(chatSessions).values({
      sessionId: newSessionId,
      userOpenId: userOpenId,
      title: "New Chat",
      isActive: true,
    });

    return { sessionId: newSessionId, conversationId: result[0].insertId };
  } catch (error) {
    console.error("[Database] Failed to create chat session:", error);
    return { sessionId: newSessionId, conversationId: 0 };
  }
}

// Update session title based on first message
export async function updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return false;
  }

  try {
    const truncatedTitle = title.length > 100 ? title.substring(0, 100) + "..." : title;
    await db.update(chatSessions)
      .set({ title: truncatedTitle })
      .where(eq(chatSessions.sessionId, sessionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update session title:", error);
    return false;
  }
}
