import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  StatusBar,
  Platform,
  Vibration,
  Text,
  SafeAreaView,
  PanResponder,
  Easing,
} from "react-native";
import { MessageCircle, Minus, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AIChatScreen from "../app/(tabs)/ai-chat";
import { useTheme } from "@/src/context/ThemeContext";

// Enhanced interface
interface AIChatScreenProps {
  onClose?: () => void;
  onMinimize?: () => void;
}

// Clean constants
const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const BUTTON_SIZE = 60;
const EDGE_MARGIN = 20;

// Smooth animations
const ANIMATIONS = {
  spring: {
    tension: 300,
    friction: 20,
    useNativeDriver: true,
  },
  timing: {
    duration: 150,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  },
} as const;

export default function FloatingChatButton() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // State
  const [showChat, setShowChat] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [snapSide, setSnapSide] = useState<"left" | "right">("right");

  // Animation refs
  const pan = useRef(new Animated.ValueXY()).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Calculate initial position
  const initialPosition = useMemo(() => {
    const safeBottom = insets.bottom + 100;
    const safeTop = insets.top + 80;
    const centerY = (screenHeight - safeBottom - safeTop) / 2;

    return {
      x: screenWidth - EDGE_MARGIN - BUTTON_SIZE,
      y: centerY,
    };
  }, [insets]);

  // Set initial position
  useEffect(() => {
    pan.setOffset(initialPosition);
  }, [initialPosition]);

  // Pan responder
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },

      onPanResponderGrant: () => {
        setIsDragging(true);

        if (Platform.OS === "ios") {
          Vibration.vibrate([10]);
        }

        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1.05,
            ...ANIMATIONS.spring,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.9,
            ...ANIMATIONS.timing,
          }),
        ]).start();
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);

        const currentX = pan.x._offset + gestureState.dx;
        const currentY = pan.y._offset + gestureState.dy;

        const snapToLeft = currentX < screenWidth / 2;
        const newSnapSide = snapToLeft ? "left" : "right";
        setSnapSide(newSnapSide);

        const snapX = snapToLeft
          ? EDGE_MARGIN
          : screenWidth - EDGE_MARGIN - BUTTON_SIZE;

        const minY = insets.top + 60;
        const maxY = screenHeight - insets.bottom - BUTTON_SIZE - 60;
        const snapY = Math.max(minY, Math.min(maxY, currentY));

        pan.setOffset({ x: currentX, y: currentY });
        pan.setValue({ x: 0, y: 0 });

        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: snapX - currentX, y: snapY - currentY },
            ...ANIMATIONS.spring,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            ...ANIMATIONS.spring,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            ...ANIMATIONS.timing,
          }),
        ]).start(() => {
          pan.setOffset({ x: snapX, y: snapY });
          pan.setValue({ x: 0, y: 0 });
        });
      },
    });
  }, [pan, scaleAnim, opacityAnim, insets]);

  // Press handler
  const handlePress = useCallback(() => {
    if (isDragging) return;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...ANIMATIONS.spring,
      }),
    ]).start();

    if (Platform.OS === "ios") {
      Vibration.vibrate([30]);
    }

    setShowChat(true);
  }, [isDragging, scaleAnim]);

  const handleClose = useCallback(() => {
    setShowChat(false);
  }, []);

  const handleMinimize = useCallback(() => {
    setShowChat(false);
  }, []);

  // Create dynamic styles
  const dynamicStyles = useMemo(() => createFloatingChatStyles(colors, isDark), [colors, isDark]);

  return (
    <>
      <Animated.View
        style={[
          dynamicStyles.container,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scaleAnim },
            ],
            opacity: opacityAnim,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={dynamicStyles.button}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={[dynamicStyles.glassEffect, { backgroundColor: colors.emerald500 + "80" }]} />
          <MessageCircle size={26} color="#ffffff" strokeWidth={2} />
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={showChat}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
        statusBarTranslucent={Platform.OS === "android"}
      >
        <View style={[dynamicStyles.modalContainer, { backgroundColor: colors.background }]}>
          <StatusBar
            barStyle={isDark ? "light-content" : "dark-content"}
            backgroundColor={colors.background}
            translucent={Platform.OS === "android"}
          />

          {/* Chat content - Full screen */}
          <View style={dynamicStyles.chatContent}>
            <AIChatScreen onClose={handleClose} onMinimize={handleMinimize} />
          </View>
        </View>
      </Modal>
    </>
  );
}

// Create dynamic styles function
const createFloatingChatStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  glassEffect: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: colors.emerald500,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  modalContainer: {
    flex: 1,
  },
  chatContent: {
    flex: 1,
  },
});