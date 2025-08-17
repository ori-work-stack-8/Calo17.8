import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Send,
  Bot,
  User,
  AlertTriangle,
  Shield,
  Heart,
  Sparkles,
  Clock,
  MessageCircle,
  Trash2,
  RotateCcw,
  Info,
  X,
  Minus,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { chatAPI, questionnaireAPI } from "@/src/services/api";
import i18n from "@/src/i18n";
import LoadingScreen from "@/components/LoadingScreen";
import { useTheme } from "@/src/context/ThemeContext";

const { width } = Dimensions.get("window");

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  hasWarning?: boolean;
  allergenWarning?: string[];
  suggestions?: string[];
}

interface UserProfile {
  allergies: string[];
  medicalConditions: string[];
  dietaryPreferences: string[];
  goals: string[];
}

interface AIChatScreenProps {
  onClose?: () => void;
  onMinimize?: () => void;
}

export default function AIChatScreen({ onClose, onMinimize }: AIChatScreenProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    allergies: [],
    medicalConditions: [],
    dietaryPreferences: [],
    goals: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const isRTL = i18n.language === "he";

  // Create dynamic styles based on theme
  const dynamicStyles = createDynamicStyles(colors, isDark);

  const texts = {
    title: t("ai_chat.title"),
    subtitle: t("ai_chat.subtitle"),
    typePlaceholder: t("ai_chat.type_message"),
    send: t("ai_chat.send"),
    typing: t("ai_chat.typing"),
    allergenWarning:
      t("ai_chat.allergen_warning") ||
      (language === "he" ? "אזהרת אלרגן!" : "Allergen Warning!"),
    clearChat: t("ai_chat.clear_history"),
    tryThese:
      t("ai_chat.try_these") ||
      (language === "he" ? "נסה את אלה:" : "Try these:"),
    welcomeMessage: t("ai_chat.welcome_message"),
    commonQuestions: [
      t("ai_chat.suggestion_breakfast"),
      t("ai_chat.suggestion_healthy"),
      t("ai_chat.suggestion_quick"),
      t("ai_chat.suggestion_vegetarian"),
      t("ai_chat.suggestion_snacks"),
    ],
    loading: t("common.loading"),
    error: t("common.error"),
    networkError: t("ai_chat.network_error"),
    loadingProfile:
      t("ai_chat.loading_profile") ||
      (language === "he" ? "טוען פרופיל משתמש..." : "Loading user profile..."),
  };

  // Load user profile and chat history on component mount
  useEffect(() => {
    loadUserProfile();
    loadChatHistory();
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const loadUserProfile = async () => {
    try {
      console.log("🔄 Loading user profile from questionnaire...");
      const response = await questionnaireAPI.getQuestionnaire();

      if (response.success && response.data) {
        const questionnaire = response.data;

        // Extract user profile data from questionnaire
        const profile: UserProfile = {
          allergies: Array.isArray(questionnaire.allergies)
            ? questionnaire.allergies
            : questionnaire.allergies_text || [],
          medicalConditions: Array.isArray(
            questionnaire.medical_conditions_text
          )
            ? questionnaire.medical_conditions_text
            : [],
          dietaryPreferences: questionnaire.dietary_style
            ? [questionnaire.dietary_style]
            : [],
          goals: questionnaire.main_goal ? [questionnaire.main_goal] : [],
        };

        setUserProfile(profile);
        console.log("✅ User profile loaded:", profile);
      } else {
        console.log("⚠️ No questionnaire data found, using empty profile");
      }
    } catch (error) {
      console.error("💥 Error loading user profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChatHistory = async () => {
    try {
      console.log("📜 Loading chat history...");
      const response = await chatAPI.getChatHistory(20);

      if (
        response &&
        response.success &&
        response.data &&
        response.data.length > 0
      ) {
        const chatMessages: Message[] = response.data
          .map((msg: any) => [
            {
              id: `user-${msg.message_id}`,
              type: "user" as const,
              content: msg.user_message,
              timestamp: new Date(msg.created_at),
            },
            {
              id: `bot-${msg.message_id}`,
              type: "bot" as const,
              content: msg.ai_response,
              timestamp: new Date(msg.created_at),
              hasWarning: checkForAllergens(msg.ai_response).length > 0,
              allergenWarning: checkForAllergens(msg.ai_response),
            },
          ])
          .flat();

        setMessages(chatMessages);
        console.log("✅ Loaded", chatMessages.length, "chat messages");
      } else {
        // Show welcome message if no chat history
        setMessages([
          {
            id: "welcome",
            type: "bot",
            content: texts.welcomeMessage,
            timestamp: new Date(),
            suggestions: texts.commonQuestions,
          },
        ]);
      }
    } catch (error) {
      console.error("💥 Error loading chat history:", error);
      // Show welcome message on error
      setMessages([
        {
          id: "welcome",
          type: "bot",
          content: texts.welcomeMessage,
          timestamp: new Date(),
          suggestions: texts.commonQuestions,
        },
      ]);
    }
  };

  const checkForAllergens = (messageContent: string): string[] => {
    if (!userProfile.allergies || userProfile.allergies.length === 0) {
      return [];
    }

    const allergenMap: Record<string, string[]> = {
      nuts: [
        "אגוזים",
        "בוטנים",
        "שקדים",
        "אגוז",
        "לוז",
        "nuts",
        "peanuts",
        "almonds",
        "walnuts",
      ],
      dairy: [
        "חלב",
        "גבינה",
        "יוגורט",
        "חמאה",
        "dairy",
        "milk",
        "cheese",
        "yogurt",
        "butter",
      ],
      gluten: [
        "חיטה",
        "קמח",
        "לחם",
        "פסטה",
        "wheat",
        "flour",
        "bread",
        "pasta",
        "gluten",
      ],
      eggs: ["ביצים", "ביצה", "eggs", "egg"],
      fish: ["דג", "דגים", "סלמון", "טונה", "fish", "salmon", "tuna"],
      soy: ["סויה", "טופו", "soy", "tofu"],
      shellfish: [
        "סרטנים",
        "לובסטר",
        "שרימפס",
        "shellfish",
        "crab",
        "lobster",
        "shrimp",
      ],
    };

    const foundAllergens: string[] = [];

    userProfile.allergies.forEach((allergy) => {
      const allergyLower = allergy.toLowerCase();

      // Check direct match first
      if (messageContent.toLowerCase().includes(allergyLower)) {
        foundAllergens.push(allergy);
        return;
      }

      // Check mapped keywords
      const mappedKeywords = allergenMap[allergyLower];
      if (mappedKeywords) {
        const hasAllergen = mappedKeywords.some((keyword) =>
          messageContent.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasAllergen) {
          foundAllergens.push(allergy);
        }
      }
    });

    return foundAllergens;
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentMessage = inputText.trim();
    setInputText("");
    setIsTyping(true);

    // Auto-scroll after adding user message
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      console.log("💬 Sending message to AI:", currentMessage);

      const response = await chatAPI.sendMessage(
        currentMessage,
        language === "he" ? "hebrew" : "english"
      );

      console.log("🔍 Full API response structure:", response);

      // Handle both direct response format and nested response format
      let aiResponseContent = "";
      let responseData = null;

      if (response.success && response.response) {
        // Handle nested response format
        responseData = response.response;
        aiResponseContent = response.response.response || response.response;
      } else if (response.response && response.response.response) {
        // Handle direct response format from server
        responseData = response.response;
        aiResponseContent = response.response.response;
      } else if (response.response && typeof response.response === "string") {
        // Handle simple string response
        aiResponseContent = response.response;
      } else if (typeof response === "string") {
        // Handle direct string response
        aiResponseContent = response;
      } else {
        console.error("🚨 Unexpected response format:", response);
        throw new Error("Invalid response format from server");
      }

      if (!aiResponseContent || aiResponseContent.trim() === "") {
        throw new Error("Empty response from AI");
      }

      console.log("✅ Extracted AI response content:", aiResponseContent);

      const allergens = checkForAllergens(aiResponseContent);

      const aiMessage: Message = {
        id: `bot-${Date.now()}`,
        type: "bot",
        content: aiResponseContent,
        timestamp: new Date(),
        hasWarning: allergens.length > 0,
        allergenWarning: allergens.length > 0 ? allergens : undefined,
        suggestions:
          Math.random() > 0.7 ? texts.commonQuestions.slice(0, 3) : undefined,
      };

      setMessages((prev) => [...prev, aiMessage]);
      console.log("✅ AI response received and displayed successfully");
    } catch (error) {
      console.error("💥 Error sending message:", error);

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: "bot",
        content:
          language === "he"
            ? "מצטער, אירעה שגיאה בתקשורת עם השרת. אנא נסה שוב."
            : "Sorry, there was an error communicating with the server. Please try again.",
        timestamp: new Date(),
        hasWarning: true,
      };

      setMessages((prev) => [...prev, errorMessage]);

      Alert.alert(texts.error, texts.networkError);
    } finally {
      setIsTyping(false);
      // Auto-scroll after AI response
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  };

  const clearChat = () => {
    Alert.alert(
      texts.clearChat,
      language === "he"
        ? "האם אתה בטוח שברצונך למחוק את השיחה?"
        : "Are you sure you want to clear the chat?",
      [
        { text: language === "he" ? "ביטול" : "Cancel", style: "cancel" },
        {
          text: texts.clearChat,
          style: "destructive",
          onPress: async () => {
            try {
              await chatAPI.clearHistory();
              setMessages([
                {
                  id: "welcome",
                  type: "bot",
                  content: texts.welcomeMessage,
                  timestamp: new Date(),
                  suggestions: texts.commonQuestions,
                },
              ]);
              console.log("🗑️ Chat history cleared");
            } catch (error) {
              console.error("💥 Error clearing chat:", error);
              // Don't show error alert for clearing history
              console.log("⚠️ Failed to clear chat history, but continuing");
            }
          },
        },
      ]
    );
  };

  const selectSuggestion = (suggestion: string) => {
    setInputText(suggestion);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(language === "he" ? "he-IL" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderMessage = (message: Message) => {
    const isUser = message.type === "user";

    return (
      <View key={message.id} style={styles.messageContainer}>
        <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
          {!isUser && (
            <View style={styles.botIconContainer}>
              <Bot size={20} color="#16A085" />
            </View>
          )}

          <View style={styles.messageContentContainer}>
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.botBubble,
                message.hasWarning && styles.warningBubble,
              ]}
            >
              {message.hasWarning && (
                <View style={styles.warningBanner}>
                  <AlertTriangle size={16} color="#E74C3C" />
                  <Text style={styles.warningText}>
                    {texts.allergenWarning}
                  </Text>
                </View>
              )}

              <Text style={[styles.messageText, isUser && styles.userText]}>
                {message.content}
              </Text>

              <Text style={[styles.timestamp, isUser && styles.userTimestamp]}>
                {formatTime(message.timestamp)}
              </Text>
            </View>

            {message.suggestions && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>{texts.tryThese}</Text>
                <View style={styles.suggestionsGrid}>
                  {message.suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionButton}
                      onPress={() => selectSuggestion(suggestion)}
                    >
                      <Text style={styles.suggestionButtonText}>
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {isUser && (
            <View style={styles.userIconContainer}>
              <User size={20} color="#FFFFFF" />
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <LoadingScreen text={isRTL ? "טוען בינה מלכותית" : "Loading AI..."} />
    );
  }

  return (
    <SafeAreaView style={[dynamicStyles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[dynamicStyles.header, { backgroundColor: colors.background }]}>
        <View style={dynamicStyles.headerLeft}>
          <View style={dynamicStyles.titleContainer}>
            <Text style={[dynamicStyles.title, { color: colors.text }]}>{texts.title}</Text>
            <Text style={[dynamicStyles.subtitle, { color: colors.textSecondary }]}>{texts.subtitle}</Text>
          </View>
        </View>
        <View style={dynamicStyles.headerActions}>
          {onMinimize && (
            <TouchableOpacity 
              style={[dynamicStyles.headerButton, { backgroundColor: colors.surface }]} 
              onPress={onMinimize}
            >
              <Minus size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[dynamicStyles.headerButton, { backgroundColor: colors.surface }]} 
            onPress={clearChat}
          >
            <Trash2 size={20} color="#E74C3C" />
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity 
              style={[dynamicStyles.headerButton, { backgroundColor: colors.surface }]} 
              onPress={onClose}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={[dynamicStyles.messagesContainer, { backgroundColor: colors.background }]}
        contentContainerStyle={dynamicStyles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card - Only show if user has profile data */}
        {(userProfile.allergies.length > 0 ||
          userProfile.medicalConditions.length > 0) && (
          <View style={[dynamicStyles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={dynamicStyles.profileHeader}>
              <Shield size={18} color="#16A085" />
              <Text style={[dynamicStyles.profileTitle, { color: colors.text }]}>
                {language === "he" ? "פרופיל בטיחות" : "Safety Profile"}
              </Text>
            </View>
            <View style={dynamicStyles.profileContent}>
              {userProfile.allergies.length > 0 && (
                <View style={dynamicStyles.profileSection}>
                  <Text style={[dynamicStyles.profileLabel, { color: colors.textSecondary }]}>
                    {language === "he" ? "אלרגיות:" : "Allergies:"}
                  </Text>
                  <View style={dynamicStyles.tagContainer}>
                    {userProfile.allergies.map((allergy, index) => (
                      <View key={index} style={dynamicStyles.allergyTag}>
                        <Text style={dynamicStyles.allergyTagText}>{allergy}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {userProfile.medicalConditions.length > 0 && (
                <View style={dynamicStyles.profileSection}>
                  <Text style={[dynamicStyles.profileLabel, { color: colors.textSecondary }]}>
                    {language === "he" ? "מצבים רפואיים:" : "Medical:"}
                  </Text>
                  <View style={dynamicStyles.tagContainer}>
                    {userProfile.medicalConditions.map((condition, index) => (
                      <View key={index} style={dynamicStyles.medicalTag}>
                        <Text style={dynamicStyles.medicalTagText}>{condition}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
        {messages.map(renderMessage)}

        {isTyping && (
          <View style={dynamicStyles.typingIndicator}>
            <View style={dynamicStyles.typingRow}>
              <View style={dynamicStyles.botIconContainer}>
                <Bot size={20} color="#16A085" />
              </View>
              <View style={[dynamicStyles.typingBubble, { backgroundColor: colors.card }]}>
                <ActivityIndicator size="small" color="#16A085" />
                <Text style={[dynamicStyles.typingText, { color: colors.textSecondary }]}>{texts.typing}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[dynamicStyles.inputArea, { backgroundColor: colors.background }]}
      >
        <View style={[dynamicStyles.inputContainer, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[
              dynamicStyles.textInput,
              { 
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text
              }
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={texts.typePlaceholder}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
            textAlign={language === "he" ? "right" : "left"}
            onSubmitEditing={() => {
              if (inputText.trim() && !isTyping) {
                sendMessage();
              }
            }}
          />
          <TouchableOpacity
            style={[
              dynamicStyles.sendButton,
              (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            <LinearGradient
              colors={
                !inputText.trim() || isTyping
                  ? ["#BDC3C7", "#95A5A6"]
                  : ["#16A085", "#1ABC9C"]
              }
              style={dynamicStyles.sendGradient}
            >
              <Send size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Create dynamic styles function
const createDynamicStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  profileContent: {
    gap: 12,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginRight: 12,
    minWidth: 70,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  allergyTag: {
    backgroundColor: "#FDEBEA",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E74C3C",
  },
  allergyTagText: {
    fontSize: 12,
    color: "#E74C3C",
    fontWeight: "500",
  },
  medicalTag: {
    backgroundColor: "#F4ECF7",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9B59B6",
  },
  medicalTagText: {
    fontSize: 12,
    color: "#9B59B6",
    fontWeight: "500",
  },
  messagesContainer: {
    flex: 1,
    marginTop: 16,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 24,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  userMessageRow: {
    flexDirection: "row-reverse",
  },
  botIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F8F5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  userIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16A085",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  messageContentContainer: {
    flex: 1,
    maxWidth: width - 120,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: "#16A085",
    alignSelf: "flex-end",
  },
  botBubble: {
    backgroundColor: colors.card,
    alignSelf: "flex-start",
  },
  warningBubble: {
    borderLeftWidth: 4,
    borderLeftColor: "#E74C3C",
    backgroundColor: "#FDEBEA",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E74C3C",
  },
  warningText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E74C3C",
    marginLeft: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
  },
  userText: {
    color: "#FFFFFF",
  },
  timestamp: {
    fontSize: 11,
    color: "#95A5A6",
    marginTop: 6,
  },
  userTimestamp: {
    color: "rgba(255,255,255,0.8)",
    textAlign: "right",
  },
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionButton: {
    backgroundColor: "#E8F8F5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#16A085",
  },
  suggestionButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#16A085",
  },
  typingIndicator: {
    marginBottom: 24,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 20,
  },
  sendButton: {
    borderRadius: 20,
    overflow: "hidden",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
