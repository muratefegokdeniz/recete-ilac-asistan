import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Platform } from "react-native";
import { useFonts } from "expo-font";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { Colors } from "../constants/Colors";
import { getProfile } from "../services/database";

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      import("../services/notifications.web").then((m) => m.rehydrateReminders());
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setProfileChecked(false);
      setHasProfile(false);
      return;
    }
    getProfile()
      .then((p) => {
        setHasProfile(!!p?.fullName);
        setProfileChecked(true);
      })
      .catch(() => {
        setProfileChecked(true);
        setHasProfile(false);
      });
  }, [session]);

  useEffect(() => {
    if (loading || (session && !profileChecked)) return;
    const inAuthGroup = segments[0] === "login";

    if (!session) {
      if (!inAuthGroup) router.replace("/login");
      return;
    }
    if (!hasProfile) {
      // Profili olmayan kullanıcılar /login'de kalır — login.tsx bu durumu
      // kendi içinde algılayıp onboarding wizard'ını gösterir.
      if (!inAuthGroup) router.replace("/login");
      return;
    }
    if (inAuthGroup) router.replace("/(tabs)/home");
  }, [session, loading, segments, profileChecked, hasProfile]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
