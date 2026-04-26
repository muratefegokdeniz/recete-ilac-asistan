import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Colors, Radius, Shadows } from "../../constants/Colors";
import { chatWithAssistant } from "../../services/anthropic";
import {
  getChatConversations,
  upsertChatConversation,
  deleteChatConversation,
  ChatConversation,
} from "../../services/database";
import { ChatMessage } from "../../types";

const QUICK_QUESTIONS = [
  "Bu ilaç süt ile alınabilir mi?",
  "Antibiyotik kullanırken alkol zararlı mı?",
  "Ağrı kesiciler aç karnına alınır mı?",
  "İlaçları birlikte almak zararlı mı?",
];

function makeWelcome(): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Merhaba! Ben İlaç Asistanınım 👋\n\nİlaçlar hakkında merak ettiğin her şeyi sorabilirsin. Örneğin:\n• İlaç etkileşimleri\n• Yan etkiler\n• Kullanım zamanlaması\n• İlaç ile beslenme ilişkisi\n\nNasıl yardımcı olabilirim?",
    timestamp: new Date().toISOString(),
  };
}

function newConvId() {
  return `conv_${Date.now()}`;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([makeWelcome()]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  async function loadConversations() {
    try {
      const convs = await getChatConversations();
      setConversations(convs);
    } catch (_) {}
  }

  async function sendMessage(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const reply = await chatWithAssistant(history, messageText);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Auto-save conversation
      const convId = currentConvId ?? newConvId();
      if (!currentConvId) setCurrentConvId(convId);

      const title = messageText.length > 45
        ? messageText.substring(0, 45) + "…"
        : messageText;

      const conv: ChatConversation = {
        id: convId,
        title,
        messages: finalMessages.filter((m) => m.id !== "welcome"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await upsertChatConversation(conv);
      await loadConversations();
    } catch (err) {
      Alert.alert("Hata", "Yanıt alınamadı. API anahtarınızı kontrol edin.");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  }

  function openConversation(conv: ChatConversation) {
    setCurrentConvId(conv.id);
    setMessages([makeWelcome(), ...conv.messages]);
    setDrawerOpen(false);
  }

  function startNewChat() {
    setCurrentConvId(null);
    setMessages([makeWelcome()]);
    setDrawerOpen(false);
  }

  async function handleDeleteConv(id: string) {
    try {
      await deleteChatConversation(id);
      if (currentConvId === id) startNewChat();
      await loadConversations();
    } catch (_) {}
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Drawer overlay */}
      {drawerOpen && (
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}
        />
      )}

      {/* History drawer */}
      {drawerOpen && (
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Sohbet Geçmişi</Text>
            <TouchableOpacity onPress={() => setDrawerOpen(false)}>
              <MaterialIcons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat} activeOpacity={0.8}>
            <MaterialIcons name="add" size={18} color={Colors.textInverse} />
            <Text style={styles.newChatBtnText}>Yeni Sohbet</Text>
          </TouchableOpacity>

          <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
            {conversations.length === 0 ? (
              <Text style={styles.drawerEmpty}>Henüz kayıtlı sohbet yok.</Text>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === currentConvId;
                return (
                  <TouchableOpacity
                    key={conv.id}
                    style={[styles.convItem, isActive && styles.convItemActive]}
                    onPress={() => openConversation(conv)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.convItemLeft}>
                      <MaterialIcons
                        name="chat-bubble-outline"
                        size={16}
                        color={isActive ? Colors.primary : Colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.convTitle, isActive && styles.convTitleActive]}
                          numberOfLines={2}
                        >
                          {conv.title}
                        </Text>
                        <Text style={styles.convDate}>
                          {new Date(conv.updatedAt).toLocaleDateString("tr-TR", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteConv(conv.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => setDrawerOpen(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="menu" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.avatarIcon}>
            <Ionicons name="medical" size={18} color={Colors.textInverse} />
          </View>
          <View>
            <Text style={styles.headerTitle}>İlaç Asistanı</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Çevrimiçi</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={startNewChat} style={styles.clearBtn}>
          <MaterialIcons name="edit" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {loading && (
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.typingText}>Yanıt yazıyor...</Text>
            </View>
          )}
        </ScrollView>

        {messages.length <= 1 && !loading && (
          <View style={styles.quickQuestions}>
            <Text style={styles.quickTitle}>Hızlı Sorular</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickRow}>
                {QUICK_QUESTIONS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={styles.quickChip}
                    onPress={() => sendMessage(q)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickChipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="İlaç hakkında bir şey sor..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || loading}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send"
                size={18}
                color={input.trim() && !loading ? Colors.textInverse : Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimer}>
            Asistan genel bilgi verir. Tıbbi tavsiye için doktorunuza başvurun.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant]}>
      {!isUser && (
        <View style={styles.assistantAvatar}>
          <Ionicons name="medical" size={14} color={Colors.textInverse} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeAssistant]}>
          {new Date(message.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  keyboardAvoid: { flex: 1 },

  // Drawer
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 10,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    zIndex: 20,
    paddingTop: Platform.OS === "ios" ? 48 : 16,
    paddingBottom: 24,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  drawerTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
  },
  newChatBtnText: { fontSize: 14, fontWeight: "700", color: Colors.textInverse },
  drawerList: { flex: 1 },
  drawerEmpty: { fontSize: 13, color: Colors.textMuted, textAlign: "center", marginTop: 24, paddingHorizontal: 16 },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  convItemActive: { backgroundColor: Colors.primaryLight },
  convItemLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  convTitle: { fontSize: 13, fontWeight: "500", color: Colors.text, lineHeight: 18 },
  convTitleActive: { color: Colors.primary, fontWeight: "700" },
  convDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  hamburgerBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
  },
  avatarIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.secondary },
  onlineText: { fontSize: 12, color: Colors.secondary, fontWeight: "500" },
  clearBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    borderRadius: 10, backgroundColor: Colors.surfaceAlt,
  },

  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 8, paddingBottom: 8 },

  bubbleWrapper: { flexDirection: "row", alignItems: "flex-end", gap: 6, maxWidth: "85%" },
  bubbleWrapperUser: { alignSelf: "flex-end" },
  bubbleWrapperAssistant: { alignSelf: "flex-start" },
  assistantAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2, flexShrink: 0,
  },
  bubble: { borderRadius: Radius.lg, padding: 12, maxWidth: "100%" },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4, ...Shadows.sm },
  bubbleAssistant: {
    backgroundColor: Colors.surface, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: Colors.textInverse },
  bubbleTextAssistant: { color: Colors.text },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeUser: { color: "rgba(255,255,255,0.65)", textAlign: "right" },
  bubbleTimeAssistant: { color: Colors.textMuted },

  typingBubble: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12,
    alignSelf: "flex-start", borderWidth: 1, borderColor: Colors.border,
  },
  typingText: { fontSize: 13, color: Colors.textSecondary },

  quickQuestions: { paddingHorizontal: 16, paddingBottom: 8 },
  quickTitle: { fontSize: 12, fontWeight: "600", color: Colors.textMuted, marginBottom: 8 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full, backgroundColor: Colors.primaryLight,
    borderWidth: 1, borderColor: Colors.primary + "30",
  },
  quickChipText: { fontSize: 13, color: Colors.primary, fontWeight: "500" },

  inputContainer: {
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 16, paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.background,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", ...Shadows.sm,
  },
  sendBtnDisabled: { backgroundColor: Colors.surfaceAlt },
  disclaimer: { fontSize: 11, color: Colors.textMuted, textAlign: "center", marginTop: 6 },
});
