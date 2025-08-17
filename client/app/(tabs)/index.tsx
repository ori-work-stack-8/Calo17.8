import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  Camera,
  TrendingUp,
  Droplets,
  Target,
  Calendar,
  Zap,
  Award,
  ChefHat,
  Plus,
  Eye,
  Clock,
  Flame,
  Activity,
  Heart,
  Star,
  ArrowRight,
  Utensils,
  BarChart3,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/src/store";
import { fetchMeals } from "@/src/store/mealSlice";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/src/services/api";
import LoadingScreen from "@/components/LoadingScreen";
import XPNotification from "@/components/XPNotification";

const { width: screenWidth } = Dimensions.get("window");

interface DailyGoals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  water_ml: number;
}

interface TodayStats {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water_cups: number;
  meal_count: number;
}

interface UserStats {
  level: number;
  current_xp: number;
  total_points: number;
  current_streak: number;
  best_streak: number;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { meals, isLoading } = useSelector((state: RootState) => state.meal);

  // State
  const [dailyGoals, setDailyGoals] = useState<DailyGoals>({
    calories: 2000,
    protein_g: 120,
    carbs_g: 250,
    fats_g: 67,
    water_ml: 2500,
  });
  const [todayStats, setTodayStats] = useState<TodayStats>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    water_cups: 0,
    meal_count: 0,
  });
  const [userStats, setUserStats] = useState<UserStats>({
    level: 1,
    current_xp: 0,
    total_points: 0,
    current_streak: 0,
    best_streak: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showXPNotification, setShowXPNotification] = useState(false);
  const [xpNotificationData, setXPNotificationData] = useState({
    xpGained: 0,
    leveledUp: false,
    newLevel: 1,
    newAchievements: [],
  });

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [])
  );

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
    ]).start();
  }, []);

  const loadHomeData = async () => {
    try {
      setIsLoadingData(true);

      // Load all data in parallel
      const [goalsResponse, waterResponse, mealsData] = await Promise.all([
        api.get("/daily-goals").catch(() => ({ data: { success: false } })),
        api.get(`/nutrition/water-intake/${new Date().toISOString().split("T")[0]}`).catch(() => ({ data: { success: false } })),
        dispatch(fetchMeals()),
      ]);

      // Set daily goals
      if (goalsResponse.data.success) {
        setDailyGoals(goalsResponse.data.data);
      }

      // Set water intake
      if (waterResponse.data.success) {
        setTodayStats(prev => ({
          ...prev,
          water_cups: waterResponse.data.data.cups_consumed || 0,
        }));
      }

      // Calculate today's nutrition from meals
      const today = new Date().toISOString().split("T")[0];
      const todayMeals = meals.filter(meal => 
        meal.created_at.startsWith(today)
      );

      const nutritionTotals = todayMeals.reduce(
        (acc, meal) => ({
          calories: acc.calories + (meal.calories || 0),
          protein: acc.protein + (meal.protein || 0),
          carbs: acc.carbs + (meal.carbs || 0),
          fat: acc.fat + (meal.fat || 0),
          meal_count: acc.meal_count + 1,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, meal_count: 0 }
      );

      setTodayStats(prev => ({
        ...prev,
        ...nutritionTotals,
      }));

      // Set user stats
      setUserStats({
        level: user?.level || 1,
        current_xp: user?.current_xp || 0,
        total_points: user?.total_points || 0,
        current_streak: user?.current_streak || 0,
        best_streak: user?.best_streak || 0,
      });

    } catch (error) {
      console.error("Error loading home data:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  }, []);

  const handleWaterIntake = async (cups: number) => {
    try {
      const response = await api.post("/nutrition/water-intake", {
        cups_consumed: cups,
      });

      if (response.data.success) {
        setTodayStats(prev => ({ ...prev, water_cups: cups }));

        // Show XP notification if XP was awarded
        if (response.data.xpAwarded > 0) {
          setXPNotificationData({
            xpGained: response.data.xpAwarded,
            leveledUp: response.data.leveledUp || false,
            newLevel: response.data.newLevel || userStats.level,
            newAchievements: response.data.newAchievements || [],
          });
          setShowXPNotification(true);

          // Update user stats
          setUserStats(prev => ({
            ...prev,
            current_xp: (prev.current_xp + response.data.xpAwarded) % 100,
            total_points: prev.total_points + response.data.xpAwarded,
            level: response.data.newLevel || prev.level,
          }));
        }
      }
    } catch (error) {
      console.error("Water intake error:", error);
      Alert.alert("Error", "Failed to update water intake");
    }
  };

  const calculateProgress = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return colors.emerald500;
    if (progress >= 75) return "#10b981";
    if (progress >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const recentMeals = useMemo(() => {
    return meals
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [meals]);

  if (isLoadingData && meals.length === 0) {
    return (
      <LoadingScreen
        text={language === "he" ? "טוען נתונים..." : "Loading your data..."}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: colors.background, opacity: fadeAnim },
        ]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>
              {t("home.welcome")}, {user?.name || "User"}! 👋
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {language === "he" ? "בואו נעקוב אחרי היעדים שלך היום" : "Let's track your goals today"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.levelBadge,
              { backgroundColor: colors.emerald500 + "15", borderColor: colors.emerald500 },
            ]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Star size={16} color={colors.emerald500} />
            <Text style={[styles.levelText, { color: colors.emerald500 }]}>
              Level {userStats.level}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.emerald500]}
            tintColor={colors.emerald500}
          />
        }
      >
        {/* Progress Overview */}
        <Animated.View
          style={[
            styles.progressCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.emerald500 + "08", colors.emerald500 + "15"]}
            style={styles.progressGradient}
          >
            <View style={styles.progressHeader}>
              <View style={styles.progressTitleContainer}>
                <Target size={20} color={colors.emerald500} />
                <Text style={[styles.progressTitle, { color: colors.text }]}>
                  {t("home.goal_progress")}
                </Text>
              </View>
              <Text style={[styles.progressDate, { color: colors.textSecondary }]}>
                {new Date().toLocaleDateString(language === "he" ? "he-IL" : "en-US")}
              </Text>
            </View>

            <View style={styles.progressGrid}>
              {/* Calories */}
              <View style={[styles.progressItem, { backgroundColor: colors.surface }]}>
                <View style={styles.progressItemHeader}>
                  <Flame size={16} color="#ef4444" />
                  <Text style={[styles.progressItemLabel, { color: colors.text }]}>
                    Calories
                  </Text>
                </View>
                <Text style={[styles.progressItemValue, { color: colors.text }]}>
                  {todayStats.calories}
                </Text>
                <Text style={[styles.progressItemGoal, { color: colors.textSecondary }]}>
                  / {dailyGoals.calories}
                </Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: getProgressColor(
                          calculateProgress(todayStats.calories, dailyGoals.calories)
                        ),
                        width: `${calculateProgress(todayStats.calories, dailyGoals.calories)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Protein */}
              <View style={[styles.progressItem, { backgroundColor: colors.surface }]}>
                <View style={styles.progressItemHeader}>
                  <Activity size={16} color="#3b82f6" />
                  <Text style={[styles.progressItemLabel, { color: colors.text }]}>
                    Protein
                  </Text>
                </View>
                <Text style={[styles.progressItemValue, { color: colors.text }]}>
                  {Math.round(todayStats.protein)}g
                </Text>
                <Text style={[styles.progressItemGoal, { color: colors.textSecondary }]}>
                  / {dailyGoals.protein_g}g
                </Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: getProgressColor(
                          calculateProgress(todayStats.protein, dailyGoals.protein_g)
                        ),
                        width: `${calculateProgress(todayStats.protein, dailyGoals.protein_g)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Water */}
              <View style={[styles.progressItem, { backgroundColor: colors.surface }]}>
                <View style={styles.progressItemHeader}>
                  <Droplets size={16} color="#06b6d4" />
                  <Text style={[styles.progressItemLabel, { color: colors.text }]}>
                    Water
                  </Text>
                </View>
                <Text style={[styles.progressItemValue, { color: colors.text }]}>
                  {todayStats.water_cups}
                </Text>
                <Text style={[styles.progressItemGoal, { color: colors.textSecondary }]}>
                  / 8 cups
                </Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: getProgressColor(
                          calculateProgress(todayStats.water_cups, 8)
                        ),
                        width: `${calculateProgress(todayStats.water_cups, 8)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Meals */}
              <View style={[styles.progressItem, { backgroundColor: colors.surface }]}>
                <View style={styles.progressItemHeader}>
                  <Utensils size={16} color="#8b5cf6" />
                  <Text style={[styles.progressItemLabel, { color: colors.text }]}>
                    Meals
                  </Text>
                </View>
                <Text style={[styles.progressItemValue, { color: colors.text }]}>
                  {todayStats.meal_count}
                </Text>
                <Text style={[styles.progressItemGoal, { color: colors.textSecondary }]}>
                  / 3 meals
                </Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: getProgressColor(
                          calculateProgress(todayStats.meal_count, 3)
                        ),
                        width: `${calculateProgress(todayStats.meal_count, 3)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View
          style={[
            styles.quickActionsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.quickActionsHeader}>
            <Zap size={20} color={colors.emerald500} />
            <Text style={[styles.quickActionsTitle, { color: colors.text }]}>
              {t("home.quick_actions")}
            </Text>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.emerald500 }]}
              onPress={() => router.push("/(tabs)/camera")}
            >
              <Camera size={24} color="#ffffff" />
              <Text style={styles.actionButtonText}>
                {t("home.scan_meal")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.surface, borderColor: colors.emerald500 },
              ]}
              onPress={() => router.push("/(tabs)/food-scanner")}
            >
              <ChefHat size={24} color={colors.emerald500} />
              <Text style={[styles.actionButtonText, { color: colors.emerald500 }]}>
                Scan Product
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.surface, borderColor: colors.emerald500 },
              ]}
              onPress={() => router.push("/(tabs)/statistics")}
            >
              <BarChart3 size={24} color={colors.emerald500} />
              <Text style={[styles.actionButtonText, { color: colors.emerald500 }]}>
                {t("home.view_statistics")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.surface, borderColor: colors.emerald500 },
              ]}
              onPress={() => router.push("/(tabs)/recommended-menus")}
            >
              <Award size={24} color={colors.emerald500} />
              <Text style={[styles.actionButtonText, { color: colors.emerald500 }]}>
                Meal Plans
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Water Intake Widget */}
        <Animated.View
          style={[
            styles.waterCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.waterHeader}>
            <View style={styles.waterTitleContainer}>
              <Droplets size={20} color="#06b6d4" />
              <Text style={[styles.waterTitle, { color: colors.text }]}>
                {t("home.water_intake")}
              </Text>
            </View>
            <Text style={[styles.waterProgress, { color: colors.textSecondary }]}>
              {todayStats.water_cups}/8 cups
            </Text>
          </View>

          <View style={styles.waterButtons}>
            {[1, 2, 3, 4].map((cups) => (
              <TouchableOpacity
                key={cups}
                style={[
                  styles.waterButton,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => handleWaterIntake(todayStats.water_cups + cups)}
              >
                <Droplets size={16} color="#06b6d4" />
                <Text style={[styles.waterButtonText, { color: colors.text }]}>
                  +{cups}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Recent Meals */}
        <Animated.View
          style={[
            styles.recentMealsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.recentMealsHeader}>
            <View style={styles.recentMealsTitleContainer}>
              <Clock size={20} color={colors.emerald500} />
              <Text style={[styles.recentMealsTitle, { color: colors.text }]}>
                {t("home.recent_meals")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/history")}
              style={styles.viewAllButton}
            >
              <Text style={[styles.viewAllText, { color: colors.emerald500 }]}>
                View All
              </Text>
              <ArrowRight size={14} color={colors.emerald500} />
            </TouchableOpacity>
          </View>

          {recentMeals.length === 0 ? (
            <View style={styles.emptyMeals}>
              <Utensils size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyMealsText, { color: colors.textSecondary }]}>
                No meals logged today
              </Text>
              <TouchableOpacity
                style={[styles.addFirstMealButton, { backgroundColor: colors.emerald500 }]}
                onPress={() => router.push("/(tabs)/camera")}
              >
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addFirstMealButtonText}>
                  Log Your First Meal
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mealsList}>
              {recentMeals.map((meal, index) => (
                <TouchableOpacity
                  key={meal.id}
                  style={[
                    styles.mealItem,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => router.push("/(tabs)/history")}
                >
                  <View style={styles.mealInfo}>
                    <Text style={[styles.mealName, { color: colors.text }]}>
                      {meal.name || "Unnamed Meal"}
                    </Text>
                    <Text style={[styles.mealTime, { color: colors.textSecondary }]}>
                      {new Date(meal.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={styles.mealNutrition}>
                    <Text style={[styles.mealCalories, { color: colors.text }]}>
                      {meal.calories || 0}
                    </Text>
                    <Text style={[styles.mealCaloriesLabel, { color: colors.textSecondary }]}>
                      cal
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        {/* User Stats */}
        <Animated.View
          style={[
            styles.statsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.statsHeader}>
            <Award size={20} color={colors.emerald500} />
            <Text style={[styles.statsTitle, { color: colors.text }]}>
              {t("home.user_stats")}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {userStats.current_xp}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t("home.xp")}
              </Text>
            </View>

            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {userStats.current_streak}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t("home.current_streak")}
              </Text>
            </View>

            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {userStats.best_streak}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t("home.best_streak")}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* XP Notification */}
      <XPNotification
        visible={showXPNotification}
        xpGained={xpNotificationData.xpGained}
        leveledUp={xpNotificationData.leveledUp}
        newLevel={xpNotificationData.newLevel}
        newAchievements={xpNotificationData.newAchievements}
        onHide={() => setShowXPNotification(false)}
        language={language}
      />
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
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  levelText: {
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  progressCard: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  progressGradient: {
    padding: 20,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  progressTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  progressDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  progressItem: {
    flex: 1,
    minWidth: (screenWidth - 80) / 2,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  progressItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  progressItemLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  progressItemValue: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  progressItemGoal: {
    fontSize: 12,
    marginBottom: 8,
  },
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  quickActionsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  quickActionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: (screenWidth - 80) / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  waterCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  waterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  waterTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  waterTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  waterProgress: {
    fontSize: 14,
    fontWeight: "600",
  },
  waterButtons: {
    flexDirection: "row",
    gap: 8,
  },
  waterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  waterButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  recentMealsCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  recentMealsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  recentMealsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recentMealsTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyMeals: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyMealsText: {
    fontSize: 16,
    fontWeight: "600",
  },
  addFirstMealButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
  },
  addFirstMealButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  mealsList: {
    gap: 12,
  },
  mealItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  mealTime: {
    fontSize: 12,
  },
  mealNutrition: {
    alignItems: "center",
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: "700",
  },
  mealCaloriesLabel: {
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  statsCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    textAlign: "center",
  },
});