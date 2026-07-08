import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Platform } from "react-native";
import { useFonts } from "expo-font";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { Colors } from "../constants/Colors";
import { getProfile } from "../services/database";
import { getChildSession } from "../services/childAuth";

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
    let cancelled = false;

    (async () => {
      const inAuthGroup = segments[0] === "login";
      const inChildHome = segments[0] === "child-home";

      if (!session) {
        // Gerçek bir ebeveyn oturumu yoksa, güncel bir çocuk oturumu var mı bak
        // (her navigasyonda tazeden okunur — çıkış yapınca eski durumda takılıp
        // kalmaz).
        const childSession = await getChildSession();
        if (cancelled) return;
        if (childSession) {
          if (!inChildHome) router.replace("/child-home");
          return;
        }
        if (!inAuthGroup) router.replace("/login");
        return;
      }
      if (!hasProfile) {
        // Profili olmayan kullanıcılar /login'de kalır — login.tsx bu durumu
        // kendi içinde algılayıp onboarding wizard'ını gösterir.
        if (!inAuthGroup) router.replace("/login");
        return;
      }
      if (inAuthGroup || inChildHome) router.replace("/(tabs)/home");
    })();

    return () => { cancelled = true; };
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
        <Stack.Screen name="child-home" />
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
