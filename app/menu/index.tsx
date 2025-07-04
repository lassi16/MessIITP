// app/menu/index.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import MealCard from '@/components/MealCard';
import DayPickerModal from '@/components/DayPickerModal';
import api from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import RatingTrendGraph from '@/components/RatingTrendGraph';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MenuScreen = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentDay, setCurrentDay] = useState('Monday');
  const [currentMeal, setCurrentMeal] = useState('breakfast');
  const [fullMenu, setFullMenu] = useState<{ [key: string]: { dish_name: string; type: string }[] }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [messId, setMessId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [studentId, setStudentId] = useState<number | null>(null);
  const [mealId, setMealId] = useState<number | null>(null);
  // Add new state for notification permissions
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const adminEmails = ['anish_2301mc40@iitp.ac.in', 'Jatin_2301ec12@iitp.ac.in'];
  const crEmails = ['cr1@example.com', 'cr2@example.com'];

  const messIds = [2,3,4,5,6,7]; // Replace with actual mess IDs
  const messNames = ['CV Raman', 'Asima', 'Kalam 3', 'Kalam 4', 'Aryabhatta 5', 'Aryabhatta 6']; // Replace with actual mess names

  // Theme colors
  const { color: backgroundColor, theme, toggleTheme } = useThemeColor({}, 'background');
  const { color: textColor } = useThemeColor({}, 'text');
  const { color: tintColor } = useThemeColor({}, 'tint');
  const { color: cardBackground } = useThemeColor({}, 'cardBackground');
  const { color: borderColor } = useThemeColor({}, 'border');

  // Fetch student details
  useEffect(() => {
    const fetchStudentDetails = async () => {
      const studentId = await AsyncStorage.getItem('student_id');
      if (studentId) {
        try {
          const response = await api.get(`/students/${studentId}`);
          const student = response.data;
          setUserName(student.name);
          setMessId(student.mess_id);
          setUserEmail(student.email);
          setStudentId(student.student_id);
          const { meal, day } = getCurrentMeal();
          setCurrentDay(day);
          setCurrentMeal(meal);
          console.log('meal:', meal);
          console.log('day:', day);
          // set meal id here
          const mealsResponse = await api.get('/meals', {
            params: { mess_id: student.mess_id, day: day, meal_type: meal },
          });
          if (mealsResponse.data.length > 0) {
            const mealId = mealsResponse.data[0].meal_id;
            setMealId(mealId);
          } else {
            console.log('No meals found for', meal);
            setMealId(null);
          }
        } catch (error) {
          console.error('Failed to fetch student details:', error);
        }
      }
    };

    fetchStudentDetails();
  }, []);

  const handleMealChange = async () => {
    const studentId = await AsyncStorage.getItem('student_id');
    if (studentId) {
      try {
        const response = await api.get(`/students/${studentId}`);
        const student = response.data;

        // Check if mess_id has changed
        if (student.mess_id !== messId) {
          setMessId(student.mess_id);
          // Fetch menu for the new mess
          fetchMenu();
        }
      } catch (error) {
        console.error('Failed to fetch student details:', error);
      }
    }
  };

  const fetchStudentDetails = async () => {
    const studentId = await AsyncStorage.getItem('student_id');
    if (studentId) {
      try {
        const response = await api.get(`/students/${studentId}`);
        const student = response.data;
        setUserName(student.name);

        // Check if mess_id has changed
        if (student.mess_id !== messId) {
          setMessId(student.mess_id);
          // Fetch menu for the new mess
          fetchMenu();
        }

        setUserEmail(student.email);
        setStudentId(student.student_id);

        const { meal, day } = getCurrentMeal();
        console.log('meal:', meal);
        console.log('day:', day);
        setCurrentDay(day);
        setCurrentMeal(meal);
        // set meal id here
        const mealsResponse = await api.get('/meals', {
          params: { mess_id: student.mess_id, day: day, meal_type: meal },
        });
        if (mealsResponse.data.length > 0) {
          const mealId = mealsResponse.data[0].meal_id;
          console.log('mealId:', mealId);
          setMealId(mealId);
        } else {
          console.log('No meals found for', meal);
          setMealId(null);
        }
        //set full menu here
        const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
        const fullMenuData: { [key: string]: { dish_name: string; type: string }[] } = {};

        for (const mealType of mealTypes) {
          const mealsResponse = await api.get('/meals', {
            params: { mess_id: student.mess_id, day: day, meal_type: mealType },
          });

          if (mealsResponse.data.length > 0) {
            const mealId = mealsResponse.data[0].meal_id;
            const dishesResponse = await api.get('/meal-dishes', {
              params: { meal_id: mealId },
            });
            fullMenuData[mealType] = dishesResponse.data;
          } else {
            fullMenuData[mealType] = [];
          }
        }

        setFullMenu(fullMenuData);

        scheduleMealNotifications();
      } catch (error) {
        console.error('Failed to fetch student details:', error);
      }
    }
  };

  // Use useFocusEffect to refresh student details when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchStudentDetails();
      fetchMenu();
    }, [])
  );

  // Modify the existing useEffect to remove the initial fetch
  useEffect(() => {
    // If you want to keep any initial setup, add it here
  }, []);

  // Request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Notifications are disabled. Please enable them in settings.');
      }
    };

    requestPermissions();
  }, []);

  // Schedule notifications for meal times
  const scheduleMealNotifications = async () => {
    // Cancel all existing notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const mealTimes = [
      { meal: 'breakfast', hour: 7, minute: 25 },
      { meal: 'lunch', hour: 12, minute: 25 },
      { meal: 'snacks', hour: 16, minute: 40 },
      { meal: 'dinner', hour: 19, minute: 55 },
    ];

    const now = new Date();

    for (const { meal, hour, minute } of mealTimes) {
      // Calculate the next occurrence of the meal time
      const triggerDate = new Date(now);
      triggerDate.setHours(hour, minute, 0, 0);

      // If the meal time has already passed today, schedule for the next day
      if (triggerDate <= now) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }

      // Fetch the menu for the meal
      const menu = fullMenu[meal] || [];
      const menuText = menu.map((dish) => dish.dish_name).join(', ');

      // Schedule the notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `It's ${meal} time in 5 minutes!`,
          body: `Today's menu: ${menuText}`,
          sound: true,
        },
        trigger: {
          date: triggerDate,
          type: Notifications.SchedulableTriggerInputTypes.DATE // One-time trigger
        },
      });
    }
  };

  const handleSettingsPress = () => {
    if (!studentId) {
      Alert.alert('Error', 'Student ID not found.');
      return;
    }

    if (adminEmails.includes(userEmail)) {
      router.push({
        pathname: '/settings/AdminSettings',
        params: { student_id: studentId }, // Pass student_id as a parameter
      });
    } else if (crEmails.includes(userEmail)) {
      router.push({
        pathname: '/settings/CRSettings',
        params: { student_id: studentId }, // Pass student_id as a parameter
      });
    } else {
      router.push({
        pathname: '/settings/UserSettings',
        params: { student_id: studentId }, // Pass student_id as a parameter
      });
    }
  };

  // Fetch menu when currentDay or messId changes
  useEffect(() => {
    if (currentDay && messId) {
      fetchMenu();
    }
  }, [currentDay, messId]);

  const fetchMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const mealTypes = ['breakfast', 'lunch', 'snacks', 'dinner'];
      const fullMenuData: { [key: string]: { dish_name: string; type: string }[] } = {};

      for (const mealType of mealTypes) {
        const mealsResponse = await api.get('/meals', {
          params: { mess_id: messId, day: currentDay, meal_type: currentMeal },
        });

        if (mealsResponse.data.length > 0) {
          const mealId = mealsResponse.data[0].meal_id;
          const dishesResponse = await api.get('/meal-dishes', {
            params: { meal_id: mealId },
          });
          fullMenuData[mealType] = dishesResponse.data;
        } else {
          fullMenuData[mealType] = [];
        }
      }

      setFullMenu(fullMenuData);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
      setError('Failed to fetch menu. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get current day
  const getCurrentDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = new Date().getDay();
    return days[dayIndex];
  };

  // Get current meal based on time
  const getCurrentMeal = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentDay = getCurrentDay();


    if (hours >= 7 && hours < 10 && (hours !== 7 || minutes >= 30)) {
      return { meal: 'breakfast', day: currentDay };
    } else if (hours >= 12 && hours < 14 && (hours !== 12 || minutes >= 30)) {
      return { meal: 'lunch', day: currentDay };
    } else if (hours >= 16 && hours < 18 && (hours !== 16 || minutes >= 45)) {
      return { meal: 'snacks', day: currentDay };
    } else if (hours >= 20 && hours < 22) {
      return { meal: 'dinner', day: currentDay };
    } else {
      // Outside meal hours, show the next meal
      if (hours >= 14 && hours < 18) {
        return { meal: 'snacks', day: currentDay };
      } else if (hours >= 18 && hours < 20) {
        return { meal: 'dinner', day: currentDay };
      } else if (hours >= 0 && hours < 7) {
        return { meal: 'breakfast', day: currentDay };
      } else if (hours >= 22 && hours < 24) {
        const nextDay = new Date(now);
        nextDay.setDate(now.getDate() + 1);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const nextDayName = days[nextDay.getDay()];
        return { meal: 'breakfast', day: nextDayName };
      }
    }
    return { meal: 'breakfast', day: currentDay }; // Default
  };

  const openModal = () => setIsModalVisible(true);
  const closeModal = () => setIsModalVisible(false);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Fixed Header with Greeting and Buttons */}
      <View style={[styles.header, { backgroundColor }]}>
        <Text style={[styles.greeting, { color: textColor }]}>Hi, {userName}</Text>
        {/* Group buttons in a separate View */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchMenu}>
            <Ionicons name="refresh" size={28} color={tintColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettingsPress}>
            <Ionicons name="settings" size={28} color={tintColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.themeToggleButton} onPress={toggleTheme}>
            <Ionicons name={theme === 'light' ? 'moon' : 'sunny'} size={28} color={tintColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.content}>

          {/* Loading State */}
          {loading && <ActivityIndicator size="large" color={tintColor} />}

          {/* Error Message */}
          {error && <Text style={[styles.errorText, { color: 'red' }]}>{error}</Text>}

          {/* Current Meal Card */}
          {!loading && !error && (
            <MealCard
              mealType={currentMeal}
              dishes={fullMenu[currentMeal] || []}
              mealId={mealId}
              studentId={studentId}
            />
          )}

          {/* Rating Trend Graph */}
          <RatingTrendGraph mealType={currentMeal} messIds={messIds} messNames={messNames} />

          {/* See Full Mess Menu Button */}
          <TouchableOpacity style={[styles.fullMenuButton, { backgroundColor: tintColor }]} onPress={openModal}>
            <Text style={styles.fullMenuButtonText}>See Full Mess Menu</Text>
          </TouchableOpacity>

          {/* Day Picker Modal */}
          <DayPickerModal
            visible={isModalVisible}
            onClose={closeModal}
            messId={messId ? messId.toString() : ''}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    elevation: 5,
  },
  content: {
    paddingBottom: 50, // Adjust the padding to make space for the DayPickerModal
    paddingHorizontal: -26,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Adjust the gap between buttons
  },
  refreshButton: {
    padding: 4, // Reduced padding
    borderRadius: 20,
  },
  settingsButton: {
    padding: 4, // Reduced padding
    borderRadius: 20,
  },
  themeToggleButton: {
    padding: 4, // Reduced padding
    borderRadius: 20,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  fullMenuButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  fullMenuButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MenuScreen;