import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import {
  Camera as CameraIcon,
  Scan,
  Plus,
  X,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  ShoppingCart,
  Clock,
  Zap,
  Target,
  ChefHat,
  Image as ImageIcon,
  Search,
  Trash2,
  Edit3,
  Save,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/services/api";
import LoadingScreen from "@/components/LoadingScreen";
import { router } from "expo-router";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface ScannedProduct {
  product: {
    name: string;
    brand?: string;
    category: string;
    nutrition_per_100g: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      sugar?: number;
      sodium?: number;
    };
    ingredients: string[];
    allergens: string[];
    labels: string[];
    health_score?: number;
    barcode?: string;
  };
  user_analysis: {
    compatibility_score: number;
    daily_contribution: {
      calories_percent: number;
      protein_percent: number;
      carbs_percent: number;
      fat_percent: number;
    };
    alerts: string[];
    recommendations: string[];
    health_assessment: string;
  };
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category?: string;
}

export default function FoodScannerScreen() {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  const { colors, isDark } = useTheme();

  // State management
  const [scanMode, setScanMode] = useState<"barcode" | "image">("barcode");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIngredientsModal, setShowIngredientsModal] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: "",
    unit: "g",
    category: "",
  });
  const [quantity, setQuantity] = useState("100");
  const [mealTiming, setMealTiming] = useState("SNACK");
  const [isAddingToMeal, setIsAddingToMeal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  // Refs
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    loadScanHistory();
  }, []);

  const loadScanHistory = async () => {
    try {
      const response = await api.get("/food-scanner/history");
      if (response.data.success) {
        setScanHistory(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to load scan history:", error);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (isScanning) return;

    try {
      setIsScanning(true);
      console.log("🔍 Scanning barcode:", barcode);

      const response = await api.post("/food-scanner/barcode", { barcode });

      if (response.data.success) {
        setScannedProduct(response.data.data);
        if (Platform.OS === "ios") {
          Vibration.vibrate([100]);
        }
      } else {
        Alert.alert(
          t("food_scanner.scan_failed"),
          t("food_scanner.product_not_found_message")
        );
      }
    } catch (error) {
      console.error("Barcode scan error:", error);
      Alert.alert(
        t("food_scanner.scan_failed"),
        t("food_scanner.scan_failed_message")
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleImageScan = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsScanning(true);
        
        const response = await api.post("/food-scanner/image", {
          imageBase64: result.assets[0].base64,
        });

        if (response.data.success) {
          setScannedProduct(response.data.data);
        } else {
          Alert.alert(
            t("food_scanner.scan_failed"),
            t("food_scanner.scan_failed_message")
          );
        }
      }
    } catch (error) {
      console.error("Image scan error:", error);
      Alert.alert(
        t("food_scanner.scan_failed"),
        t("food_scanner.scan_failed_message")
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera permission is required");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsScanning(true);
        
        const response = await api.post("/food-scanner/image", {
          imageBase64: result.assets[0].base64,
        });

        if (response.data.success) {
          setScannedProduct(response.data.data);
        } else {
          Alert.alert(
            t("food_scanner.scan_failed"),
            t("food_scanner.scan_failed_message")
          );
        }
      }
    } catch (error) {
      console.error("Photo scan error:", error);
      Alert.alert(
        t("food_scanner.scan_failed"),
        t("food_scanner.scan_failed_message")
      );
    } finally {
      setIsScanning(false);
    }
  };

  const addIngredient = () => {
    if (!newIngredient.name.trim() || !newIngredient.quantity.trim()) {
      Alert.alert("Error", "Please fill in ingredient name and quantity");
      return;
    }

    const ingredient: Ingredient = {
      name: newIngredient.name.trim(),
      quantity: parseFloat(newIngredient.quantity),
      unit: newIngredient.unit,
      category: newIngredient.category.trim() || "Other",
    };

    setIngredients([...ingredients, ingredient]);
    setNewIngredient({ name: "", quantity: "", unit: "g", category: "" });
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAddToMeal = async () => {
    if (!scannedProduct) return;

    try {
      setIsAddingToMeal(true);

      const response = await api.post("/food-scanner/add-to-meal", {
        productData: scannedProduct.product,
        quantity: parseFloat(quantity),
        mealTiming,
      });

      if (response.data.success) {
        Alert.alert(
          "Success",
          "Product added to meal log successfully!",
          [
            {
              text: "View Meals",
              onPress: () => router.push("/(tabs)/history"),
            },
            { text: "OK" },
          ]
        );
        setShowAddModal(false);
        setScannedProduct(null);
        loadScanHistory();
      }
    } catch (error) {
      console.error("Add to meal error:", error);
      Alert.alert("Error", "Failed to add product to meal log");
    } finally {
      setIsAddingToMeal(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return colors.emerald500;
    if (score >= 60) return "#f59e0b";
    if (score >= 40) return "#f97316";
    return "#ef4444";
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return colors.emerald500;
    if (score >= 60) return "#10b981";
    if (score >= 40) return "#f59e0b";
    return "#ef4444";
  };

  const renderScanModeSelector = () => (
    <View style={[styles.modeSelector, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={[
          styles.modeButton,
          scanMode === "barcode" && styles.modeButtonActive,
          scanMode === "barcode" && { backgroundColor: colors.emerald500 },
        ]}
        onPress={() => setScanMode("barcode")}
      >
        <Scan
          size={20}
          color={scanMode === "barcode" ? "#ffffff" : colors.text}
        />
        <Text
          style={[
            styles.modeButtonText,
            { color: scanMode === "barcode" ? "#ffffff" : colors.text },
          ]}
        >
          {t("food_scanner.barcode")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.modeButton,
          scanMode === "image" && styles.modeButtonActive,
          scanMode === "image" && { backgroundColor: colors.emerald500 },
        ]}
        onPress={() => setScanMode("image")}
      >
        <ImageIcon
          size={20}
          color={scanMode === "image" ? "#ffffff" : colors.text}
        />
        <Text
          style={[
            styles.modeButtonText,
            { color: scanMode === "image" ? "#ffffff" : colors.text },
          ]}
        >
          {t("food_scanner.image")}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderScanActions = () => (
    <View style={styles.scanActions}>
      {scanMode === "barcode" ? (
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: colors.emerald500 }]}
          onPress={() => handleBarcodeScan("1234567890123")} // Demo barcode
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Scan size={24} color="#ffffff" />
              <Text style={styles.scanButtonText}>
                {t("food_scanner.start_scan")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.imageActions}>
          <TouchableOpacity
            style={[styles.imageButton, { backgroundColor: colors.emerald500 }]}
            onPress={handleTakePhoto}
            disabled={isScanning}
          >
            <CameraIcon size={20} color="#ffffff" />
            <Text style={styles.imageButtonText}>
              {t("food_scanner.take_photo")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.imageButton,
              { backgroundColor: colors.surface, borderColor: colors.emerald500 },
            ]}
            onPress={handleImageScan}
            disabled={isScanning}
          >
            <ImageIcon size={20} color={colors.emerald500} />
            <Text style={[styles.imageButtonText, { color: colors.emerald500 }]}>
              {t("food_scanner.upload_image")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderProductDetails = () => {
    if (!scannedProduct) return null;

    const { product, user_analysis } = scannedProduct;

    return (
      <Animated.View
        style={[
          styles.productCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={[colors.emerald500 + "15", colors.emerald500 + "05"]}
          style={styles.productHeader}
        >
          <View style={styles.productInfo}>
            <Text style={[styles.productName, { color: colors.text }]}>
              {product.name}
            </Text>
            {product.brand && (
              <Text style={[styles.productBrand, { color: colors.textSecondary }]}>
                {product.brand}
              </Text>
            )}
            <View style={styles.categoryBadge}>
              <Text style={[styles.categoryText, { color: colors.emerald500 }]}>
                {product.category}
              </Text>
            </View>
          </View>

          <View style={styles.scoreContainer}>
            <View
              style={[
                styles.healthScore,
                {
                  backgroundColor: getHealthScoreColor(
                    product.health_score || 50
                  ) + "20",
                  borderColor: getHealthScoreColor(product.health_score || 50),
                },
              ]}
            >
              <Text
                style={[
                  styles.scoreText,
                  { color: getHealthScoreColor(product.health_score || 50) },
                ]}
              >
                {product.health_score || 50}
              </Text>
              <Text
                style={[
                  styles.scoreLabel,
                  { color: getHealthScoreColor(product.health_score || 50) },
                ]}
              >
                Health
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Nutrition Grid */}
        <View style={styles.nutritionGrid}>
          <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>
              {product.nutrition_per_100g.calories}
            </Text>
            <Text style={[styles.nutritionLabel, { color: colors.textSecondary }]}>
              Calories
            </Text>
          </View>
          <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>
              {product.nutrition_per_100g.protein}g
            </Text>
            <Text style={[styles.nutritionLabel, { color: colors.textSecondary }]}>
              Protein
            </Text>
          </View>
          <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>
              {product.nutrition_per_100g.carbs}g
            </Text>
            <Text style={[styles.nutritionLabel, { color: colors.textSecondary }]}>
              Carbs
            </Text>
          </View>
          <View style={[styles.nutritionItem, { backgroundColor: colors.surface }]}>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>
              {product.nutrition_per_100g.fat}g
            </Text>
            <Text style={[styles.nutritionLabel, { color: colors.textSecondary }]}>
              Fat
            </Text>
          </View>
        </View>

        {/* User Analysis */}
        <View style={styles.analysisSection}>
          <View style={styles.compatibilityHeader}>
            <Target size={16} color={colors.emerald500} />
            <Text style={[styles.analysisTitle, { color: colors.text }]}>
              Personal Analysis
            </Text>
            <View
              style={[
                styles.compatibilityBadge,
                {
                  backgroundColor: getCompatibilityColor(
                    user_analysis.compatibility_score
                  ) + "20",
                  borderColor: getCompatibilityColor(
                    user_analysis.compatibility_score
                  ),
                },
              ]}
            >
              <Text
                style={[
                  styles.compatibilityScore,
                  {
                    color: getCompatibilityColor(
                      user_analysis.compatibility_score
                    ),
                  },
                ]}
              >
                {user_analysis.compatibility_score}%
              </Text>
            </View>
          </View>

          <Text style={[styles.healthAssessment, { color: colors.text }]}>
            {user_analysis.health_assessment}
          </Text>

          {/* Alerts */}
          {user_analysis.alerts.length > 0 && (
            <View style={styles.alertsContainer}>
              {user_analysis.alerts.map((alert, index) => (
                <View key={index} style={styles.alertItem}>
                  <AlertTriangle size={14} color="#ef4444" />
                  <Text style={[styles.alertText, { color: "#ef4444" }]}>
                    {alert}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommendations */}
          {user_analysis.recommendations.length > 0 && (
            <View style={styles.recommendationsContainer}>
              {user_analysis.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Check size={14} color={colors.emerald500} />
                  <Text style={[styles.recommendationText, { color: colors.text }]}>
                    {rec}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { borderColor: colors.emerald500, backgroundColor: colors.surface },
            ]}
            onPress={() => setShowIngredientsModal(true)}
          >
            <Edit3 size={16} color={colors.emerald500} />
            <Text style={[styles.secondaryButtonText, { color: colors.emerald500 }]}>
              Edit Ingredients
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.emerald500 }]}
            onPress={() => setShowAddModal(true)}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Add to Meal</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderAddToMealModal = () => (
    <Modal
      visible={showAddModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddModal(false)}
    >
      <BlurView intensity={80} style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add to Meal Log
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Quantity (grams)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Meal Timing
              </Text>
              <View style={styles.mealTimingOptions}>
                {["BREAKFAST", "LUNCH", "DINNER", "SNACK"].map((timing) => (
                  <TouchableOpacity
                    key={timing}
                    style={[
                      styles.timingOption,
                      mealTiming === timing && {
                        backgroundColor: colors.emerald500,
                      },
                      { borderColor: colors.border },
                    ]}
                    onPress={() => setMealTiming(timing)}
                  >
                    <Text
                      style={[
                        styles.timingOptionText,
                        {
                          color:
                            mealTiming === timing ? "#ffffff" : colors.text,
                        },
                      ]}
                    >
                      {timing}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: colors.emerald500 },
                isAddingToMeal && styles.addButtonDisabled,
              ]}
              onPress={handleAddToMeal}
              disabled={isAddingToMeal}
            >
              {isAddingToMeal ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Plus size={20} color="#ffffff" />
                  <Text style={styles.addButtonText}>Add to Meal Log</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );

  const renderIngredientsModal = () => (
    <Modal
      visible={showIngredientsModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowIngredientsModal(false)}
    >
      <BlurView intensity={80} style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Manage Ingredients
            </Text>
            <TouchableOpacity
              onPress={() => setShowIngredientsModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Add New Ingredient */}
            <View style={styles.addIngredientSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Add Ingredient
              </Text>

              <View style={styles.ingredientForm}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={newIngredient.name}
                  onChangeText={(text) =>
                    setNewIngredient({ ...newIngredient, name: text })
                  }
                  placeholder="Ingredient name"
                  placeholderTextColor={colors.textSecondary}
                />

                <View style={styles.quantityRow}>
                  <TextInput
                    style={[
                      styles.quantityInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={newIngredient.quantity}
                    onChangeText={(text) =>
                      setNewIngredient({ ...newIngredient, quantity: text })
                    }
                    placeholder="100"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />

                  <View style={styles.unitSelector}>
                    {["g", "ml", "cup", "tbsp", "tsp"].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitOption,
                          newIngredient.unit === unit && {
                            backgroundColor: colors.emerald500,
                          },
                          { borderColor: colors.border },
                        ]}
                        onPress={() =>
                          setNewIngredient({ ...newIngredient, unit })
                        }
                      >
                        <Text
                          style={[
                            styles.unitText,
                            {
                              color:
                                newIngredient.unit === unit
                                  ? "#ffffff"
                                  : colors.text,
                            },
                          ]}
                        >
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={newIngredient.category}
                  onChangeText={(text) =>
                    setNewIngredient({ ...newIngredient, category: text })
                  }
                  placeholder="Category (optional)"
                  placeholderTextColor={colors.textSecondary}
                />

                <TouchableOpacity
                  style={[
                    styles.addIngredientButton,
                    { backgroundColor: colors.emerald500 },
                  ]}
                  onPress={addIngredient}
                >
                  <Plus size={16} color="#ffffff" />
                  <Text style={styles.addIngredientButtonText}>
                    Add Ingredient
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Ingredients List */}
            {ingredients.length > 0 && (
              <View style={styles.ingredientsListSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Added Ingredients ({ingredients.length})
                </Text>

                {ingredients.map((ingredient, index) => (
                  <View
                    key={index}
                    style={[
                      styles.ingredientItem,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.ingredientInfo}>
                      <Text style={[styles.ingredientName, { color: colors.text }]}>
                        {ingredient.name}
                      </Text>
                      <Text
                        style={[styles.ingredientDetails, { color: colors.textSecondary }]}
                      >
                        {ingredient.quantity} {ingredient.unit}
                        {ingredient.category && ` • ${ingredient.category}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeIngredient(index)}
                      style={styles.removeButton}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.saveIngredientsButton,
                { backgroundColor: colors.emerald500 },
              ]}
              onPress={() => setShowIngredientsModal(false)}
            >
              <Save size={16} color="#ffffff" />
              <Text style={styles.saveIngredientsButtonText}>
                Save Ingredients
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );

  const renderHistoryModal = () => (
    <Modal
      visible={showHistoryModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowHistoryModal(false)}
    >
      <BlurView intensity={80} style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Scan History
            </Text>
            <TouchableOpacity
              onPress={() => setShowHistoryModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {scanHistory.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Search size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>
                  No scan history yet
                </Text>
                <Text style={[styles.emptyHistorySubtext, { color: colors.textSecondary }]}>
                  Start scanning products to build your history
                </Text>
              </View>
            ) : (
              scanHistory.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.historyItem,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.historyItemInfo}>
                    <Text style={[styles.historyItemName, { color: colors.text }]}>
                      {item.name || item.product_name}
                    </Text>
                    {item.brand && (
                      <Text
                        style={[styles.historyItemBrand, { color: colors.textSecondary }]}
                      >
                        {item.brand}
                      </Text>
                    )}
                    <Text
                      style={[styles.historyItemDate, { color: colors.textSecondary }]}
                    >
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.historyItemType}>
                    <Text
                      style={[
                        styles.historyTypeText,
                        { color: colors.emerald500 },
                      ]}
                    >
                      {item.type}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );

  if (isScanning) {
    return (
      <LoadingScreen
        text={
          language === "he"
            ? "מנתח מוצר..."
            : "Analyzing product..."
        }
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("food_scanner.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Scan products for instant nutrition info
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.historyButton,
              { backgroundColor: colors.emerald500 + "15", borderColor: colors.emerald500 },
            ]}
            onPress={() => setShowHistoryModal(true)}
          >
            <Clock size={20} color={colors.emerald500} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Selector */}
        {renderScanModeSelector()}

        {/* Instructions */}
        <Animated.View
          style={[
            styles.instructionsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.emerald500 + "10", colors.emerald500 + "05"]}
            style={styles.instructionsGradient}
          >
            <View style={styles.instructionsHeader}>
              <Info size={20} color={colors.emerald500} />
              <Text style={[styles.instructionsTitle, { color: colors.text }]}>
                {scanMode === "barcode"
                  ? t("food_scanner.barcode_instructions")
                  : t("food_scanner.image_instructions")}
              </Text>
            </View>
            <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
              {scanMode === "barcode"
                ? "Point your camera at the product barcode for instant nutrition information"
                : "Take a clear photo of the nutrition label or product packaging"}
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Scan Actions */}
        {renderScanActions()}

        {/* Product Details */}
        {renderProductDetails()}

        {/* Quick Tips */}
        <Animated.View
          style={[
            styles.tipsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.tipsHeader}>
            <Sparkles size={16} color={colors.emerald500} />
            <Text style={[styles.tipsTitle, { color: colors.text }]}>
              Pro Tips
            </Text>
          </View>
          <View style={styles.tipsList}>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Ensure good lighting for better scan accuracy
            </Text>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Hold camera steady and focus on the barcode/label
            </Text>
            <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
              • Clean the camera lens for clearer images
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Modals */}
      {renderAddToMealModal()}
      {renderIngredientsModal()}
      {renderHistoryModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  historyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  modeSelector: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  modeButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  instructionsCard: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  instructionsGradient: {
    padding: 20,
  },
  instructionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  scanActions: {
    marginBottom: 24,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  imageActions: {
    flexDirection: "row",
    gap: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  productCard: {
    borderRadius: 20,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  productHeader: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scoreContainer: {
    alignItems: "center",
  },
  healthScore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "800",
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  nutritionGrid: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  nutritionItem: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  analysisSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  compatibilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  compatibilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  compatibilityScore: {
    fontSize: 12,
    fontWeight: "700",
  },
  healthAssessment: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  alertsContainer: {
    marginBottom: 16,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  alertText: {
    fontSize: 13,
    flex: 1,
  },
  recommendationsContainer: {
    marginBottom: 16,
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  recommendationText: {
    fontSize: 13,
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  tipsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    height: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  mealTimingOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timingOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  timingOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  addIngredientSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  ingredientForm: {
    gap: 12,
  },
  quantityRow: {
    flexDirection: "row",
    gap: 12,
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  unitSelector: {
    flexDirection: "row",
    gap: 4,
  },
  unitOption: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 44,
    alignItems: "center",
  },
  unitText: {
    fontSize: 12,
    fontWeight: "600",
  },
  addIngredientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addIngredientButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  ingredientsListSection: {
    marginBottom: 24,
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  ingredientDetails: {
    fontSize: 12,
  },
  removeButton: {
    padding: 8,
  },
  saveIngredientsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveIngredientsButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  emptyHistory: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyHistorySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyItemName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  historyItemBrand: {
    fontSize: 12,
    marginBottom: 2,
  },
  historyItemDate: {
    fontSize: 11,
  },
  historyItemType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  historyTypeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});