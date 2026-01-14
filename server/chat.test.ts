import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getOrCreateChatSession: vi.fn(),
  saveChatMessage: vi.fn(),
  getChatHistory: vi.fn(),
  getChatHistoryBySessionId: vi.fn(),
  clearChatHistory: vi.fn(),
  createNewChatSession: vi.fn(),
  updateSessionTitle: vi.fn(),
  getUserChatSessions: vi.fn(),
  updateMessageFeedback: vi.fn(),
}));

import * as chatDb from './db';

describe('Chat History Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateChatSession', () => {
    it('should return existing session when sessionId is provided', async () => {
      const mockResult = { sessionId: 'existing-session', conversationId: 1, isNew: false };
      vi.mocked(chatDb.getOrCreateChatSession).mockResolvedValue(mockResult);

      const result = await chatDb.getOrCreateChatSession('user-123', 'existing-session');
      
      expect(result.sessionId).toBe('existing-session');
      expect(result.conversationId).toBe(1);
      expect(result.isNew).toBe(false);
    });

    it('should create new session when no sessionId is provided', async () => {
      const mockResult = { sessionId: 'new-session-id', conversationId: 2, isNew: true };
      vi.mocked(chatDb.getOrCreateChatSession).mockResolvedValue(mockResult);

      const result = await chatDb.getOrCreateChatSession('user-123');
      
      expect(result.isNew).toBe(true);
      expect(result.conversationId).toBeGreaterThan(0);
    });

    it('should handle null userOpenId for anonymous users', async () => {
      const mockResult = { sessionId: 'anon-session', conversationId: 3, isNew: true };
      vi.mocked(chatDb.getOrCreateChatSession).mockResolvedValue(mockResult);

      const result = await chatDb.getOrCreateChatSession(null);
      
      expect(result.sessionId).toBeTruthy();
    });
  });

  describe('saveChatMessage', () => {
    it('should save a user message successfully', async () => {
      vi.mocked(chatDb.saveChatMessage).mockResolvedValue(1);

      const messageId = await chatDb.saveChatMessage({
        conversationId: 1,
        role: 'user',
        content: 'Hello, AI!',
      });

      expect(messageId).toBe(1);
      expect(chatDb.saveChatMessage).toHaveBeenCalledWith({
        conversationId: 1,
        role: 'user',
        content: 'Hello, AI!',
      });
    });

    it('should save an assistant message with suggestions', async () => {
      vi.mocked(chatDb.saveChatMessage).mockResolvedValue(2);

      const messageId = await chatDb.saveChatMessage({
        conversationId: 1,
        role: 'assistant',
        content: 'Here is my response',
        suggestions: ['Option 1', 'Option 2'],
        commands: [{ command: 'docker ps', description: 'List containers' }],
      });

      expect(messageId).toBe(2);
    });

    it('should return null when conversationId is 0', async () => {
      vi.mocked(chatDb.saveChatMessage).mockResolvedValue(null);

      const messageId = await chatDb.saveChatMessage({
        conversationId: 0,
        role: 'user',
        content: 'Test message',
      });

      expect(messageId).toBeNull();
    });
  });

  describe('getChatHistory', () => {
    it('should return messages in chronological order', async () => {
      const mockMessages = [
        { id: 1, conversationId: 1, role: 'user' as const, content: 'Hello', createdAt: new Date('2025-01-14T10:00:00'), suggestions: null, commands: null, feedback: null },
        { id: 2, conversationId: 1, role: 'assistant' as const, content: 'Hi there!', createdAt: new Date('2025-01-14T10:00:01'), suggestions: ['Option 1'], commands: null, feedback: null },
      ];
      vi.mocked(chatDb.getChatHistory).mockResolvedValue(mockMessages);

      const messages = await chatDb.getChatHistory(1, 100);

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should return empty array for non-existent conversation', async () => {
      vi.mocked(chatDb.getChatHistory).mockResolvedValue([]);

      const messages = await chatDb.getChatHistory(999, 100);

      expect(messages).toEqual([]);
    });
  });

  describe('getChatHistoryBySessionId', () => {
    it('should return messages for a valid sessionId', async () => {
      const mockMessages = [
        { id: 1, conversationId: 1, role: 'user' as const, content: 'Test', createdAt: new Date(), suggestions: null, commands: null, feedback: null },
      ];
      vi.mocked(chatDb.getChatHistoryBySessionId).mockResolvedValue(mockMessages);

      const messages = await chatDb.getChatHistoryBySessionId('session-123', 100);

      expect(messages).toHaveLength(1);
    });

    it('should return empty array for invalid sessionId', async () => {
      vi.mocked(chatDb.getChatHistoryBySessionId).mockResolvedValue([]);

      const messages = await chatDb.getChatHistoryBySessionId('invalid-session', 100);

      expect(messages).toEqual([]);
    });
  });

  describe('clearChatHistory', () => {
    it('should clear all messages for a session', async () => {
      vi.mocked(chatDb.clearChatHistory).mockResolvedValue(true);

      const result = await chatDb.clearChatHistory('session-123');

      expect(result).toBe(true);
    });

    it('should return true even for non-existent session', async () => {
      vi.mocked(chatDb.clearChatHistory).mockResolvedValue(true);

      const result = await chatDb.clearChatHistory('non-existent');

      expect(result).toBe(true);
    });
  });

  describe('createNewChatSession', () => {
    it('should create a new session for authenticated user', async () => {
      const mockResult = { sessionId: 'new-session', conversationId: 5 };
      vi.mocked(chatDb.createNewChatSession).mockResolvedValue(mockResult);

      const result = await chatDb.createNewChatSession('user-123');

      expect(result.sessionId).toBeTruthy();
      expect(result.conversationId).toBeGreaterThan(0);
    });

    it('should create a new session for anonymous user', async () => {
      const mockResult = { sessionId: 'anon-session', conversationId: 6 };
      vi.mocked(chatDb.createNewChatSession).mockResolvedValue(mockResult);

      const result = await chatDb.createNewChatSession(null);

      expect(result.sessionId).toBeTruthy();
    });
  });

  describe('updateSessionTitle', () => {
    it('should update session title successfully', async () => {
      vi.mocked(chatDb.updateSessionTitle).mockResolvedValue(true);

      const result = await chatDb.updateSessionTitle('session-123', 'New Title');

      expect(result).toBe(true);
    });

    it('should truncate long titles', async () => {
      vi.mocked(chatDb.updateSessionTitle).mockResolvedValue(true);

      const longTitle = 'A'.repeat(200);
      const result = await chatDb.updateSessionTitle('session-123', longTitle);

      expect(result).toBe(true);
    });
  });

  describe('getUserChatSessions', () => {
    it('should return all sessions for a user', async () => {
      const mockSessions = [
        { id: 1, sessionId: 'session-1', userId: null, userOpenId: 'user-123', title: 'Chat 1', isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, sessionId: 'session-2', userId: null, userOpenId: 'user-123', title: 'Chat 2', isActive: false, createdAt: new Date(), updatedAt: new Date() },
      ];
      vi.mocked(chatDb.getUserChatSessions).mockResolvedValue(mockSessions);

      const sessions = await chatDb.getUserChatSessions('user-123');

      expect(sessions).toHaveLength(2);
    });

    it('should return empty array for user with no sessions', async () => {
      vi.mocked(chatDb.getUserChatSessions).mockResolvedValue([]);

      const sessions = await chatDb.getUserChatSessions('new-user');

      expect(sessions).toEqual([]);
    });
  });

  describe('updateMessageFeedback', () => {
    it('should update feedback to positive', async () => {
      vi.mocked(chatDb.updateMessageFeedback).mockResolvedValue(true);

      const result = await chatDb.updateMessageFeedback(1, 'positive');

      expect(result).toBe(true);
    });

    it('should update feedback to negative', async () => {
      vi.mocked(chatDb.updateMessageFeedback).mockResolvedValue(true);

      const result = await chatDb.updateMessageFeedback(1, 'negative');

      expect(result).toBe(true);
    });

    it('should return false for non-existent message', async () => {
      vi.mocked(chatDb.updateMessageFeedback).mockResolvedValue(false);

      const result = await chatDb.updateMessageFeedback(999, 'positive');

      expect(result).toBe(false);
    });
  });
});
