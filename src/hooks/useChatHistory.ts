import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const { toast } = useToast();

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("ai_chat_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return;
    }

    setConversations(data || []);
  }, []);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingHistory(true);
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      setIsLoadingHistory(false);
      return;
    }

    setMessages((data || []).map(m => ({
      ...m,
      role: m.role as "user" | "assistant"
    })));
    setIsLoadingHistory(false);
  }, []);

  // Create new conversation
  const createConversation = useCallback(async (firstMessage?: string): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const title = firstMessage 
      ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "")
      : "New Chat";

    const { data, error } = await supabase
      .from("ai_chat_conversations")
      .insert({
        user_id: session.user.id,
        title,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
      return null;
    }

    setConversations(prev => [data, ...prev]);
    setActiveConversationId(data.id);
    setMessages([]);
    return data.id;
  }, [toast]);

  // Add message to conversation
  const addMessage = useCallback(async (
    conversationId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<Message | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase
      .from("ai_chat_messages")
      .insert({
        conversation_id: conversationId,
        user_id: session.user.id,
        role,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding message:", error);
      return null;
    }

    // Update conversation updated_at
    await supabase
      .from("ai_chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    // Update local state
    setConversations(prev => {
      const updated = prev.map(c => 
        c.id === conversationId 
          ? { ...c, updated_at: new Date().toISOString() }
          : c
      );
      return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    });

    return data ? { ...data, role: data.role as "user" | "assistant" } : null;
  }, []);

  // Update message content (for streaming)
  const updateMessageContent = useCallback(async (messageId: string, content: string) => {
    // Just update local state for performance, no need to update DB on every token
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, content } : m
    ));
  }, []);

  // Finalize message in database
  const finalizeMessage = useCallback(async (messageId: string, content: string) => {
    await supabase
      .from("ai_chat_messages")
      .update({ content })
      .eq("id", messageId);
  }, []);

  // Select conversation
  const selectConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    await fetchMessages(conversationId);
  }, [fetchMessages]);

  // Start new chat
  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    const { error } = await supabase
      .from("ai_chat_conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      console.error("Error deleting conversation:", error);
      toast({ title: "Error", description: "Failed to delete conversation", variant: "destructive" });
      return;
    }

    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
      setMessages([]);
    }
    toast({ title: "Conversation deleted" });
  }, [activeConversationId, toast]);

  // Rename conversation
  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    const { error } = await supabase
      .from("ai_chat_conversations")
      .update({ title })
      .eq("id", conversationId);

    if (error) {
      console.error("Error renaming conversation:", error);
      toast({ title: "Error", description: "Failed to rename conversation", variant: "destructive" });
      return;
    }

    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, title } : c
    ));
  }, [toast]);

  // Delete all conversations
  const deleteAllConversations = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("ai_chat_conversations")
      .delete()
      .eq("user_id", session.user.id);

    if (error) {
      console.error("Error deleting all conversations:", error);
      toast({ title: "Error", description: "Failed to delete conversations", variant: "destructive" });
      return;
    }

    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    toast({ title: "All conversations deleted" });
  }, [toast]);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    activeConversationId,
    messages,
    setMessages,
    isLoadingHistory,
    createConversation,
    addMessage,
    updateMessageContent,
    finalizeMessage,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    deleteAllConversations,
    fetchConversations,
  };
}
