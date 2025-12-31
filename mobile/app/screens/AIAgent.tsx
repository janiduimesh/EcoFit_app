import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";


export default function Chatbot() {
  const [messages, setMessages] = useState([
    { id: "1", sender: "bot", text: "Hi! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [botTyping, setBotTyping] = useState(false);
  const listRef = useRef<FlatList>(null);
  const API_URL = "http://192.168.1.9:8000/api/v1/rag/ask";

  // Auto-scroll when messages update
  useEffect(() => {
    if (listRef.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulated AI typing
    setBotTyping(true);

    console.log("Sending query:", userMessage.text);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userMessage.text }),
      });

      console.log("Response status:", response.status);

      const data = await response.json();
      console.log("Response JSON:", data);

      const botMessage = {
        id: Date.now().toString(),
        sender: "bot",
        text: data.answer || "Sorry, I couldn't find an answer.",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Fetch error:", error);
      setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "bot",
        text: "Backend error. Check server logs.",
      },
    ]);
      // const errorMessage = {
      //   id: Date.now().toString(),
      //   sender: "bot",
      //   text: "⚠️ Unable to connect to the server. Please try again.",
      // };

      // setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setBotTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.header}>EcoFit AI Assistant</Text>

          {/* Chat List */}
          <FlatList
            ref={listRef}
            data={[...messages, ...(botTyping ? [{ id: "typing", sender: "bot", text: "..." }] : [])]}
            keyExtractor={(item) => item.id}
            style={styles.chatArea}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.messageBubble,
                  item.sender === "user" ? styles.userBubble : styles.botBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    item.sender === "user" ? styles.userText : styles.botText,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            )}
          />

          {/* Input Row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              value={input}
              onChangeText={setInput}
            />

            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
    paddingHorizontal: 15,
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2E7D32",
    marginVertical: 10,
  },
  chatArea: {
    flex: 1,
    marginVertical: 10,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  userBubble: {
    backgroundColor: "#C8E6C9",
    alignSelf: "flex-end",
  },
  botBubble: {
    backgroundColor: "#F1F8E9",
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 15,
  },
  userText: {
    color: "#1B5E20",
  },
  botText: {
    color: "#33691E",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
    paddingTop: 5,
  },
  input: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },
  sendButton: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
   sendText: {
    color: "white",
    fontWeight: "bold",
  },
});


