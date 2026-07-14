import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ConfirmModal } from "./ui";
import { usePathname, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors, Radius } from "../constants/Colors";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS: {
  label: string;
  route: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { label: "Ana Sayfa", route: "/(tabs)/home", icon: "dashboard" },
  { label: "Reçete", route: "/(tabs)/prescriptions", icon: "document-scanner" },
  { label: "Dolabım", route: "/(tabs)/cabinet", icon: "medical-services" },
  { label: "Takip", route: "/(tabs)/active", icon: "alarm" },
  { label: "Takvim", route: "/(tabs)/calendar", icon: "calendar-month" },
  { label: "Asistan", route: "/(tabs)/chat", icon: "chat" },
];

export default function WebSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  function isActive(route: string) {
    return pathname.includes(route.replace("/(tabs)", ""));
  }

  function handleSignOut() {
    setShowConfirm(true);
  }

  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}>
          <MaterialIcons name="medication" size={22} color={Colors.textInverse} />
        </View>
        <Text style={styles.logoText}>İlaç Asistan</Text>
      </View>

      {/* Nav items */}
      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={item.icon}
                size={20}
                color={active ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <MaterialIcons name="logout" size={18} color={Colors.danger} />
        <Text style={styles.signOutText}>Çıkış Yap</Text>
      </TouchableOpacity>
      <ConfirmModal
        visible={showConfirm}
        title="Çıkış Yap"
        message="Hesabından çıkmak istiyor musun?"
        confirmLabel="Çıkış Yap"
        onConfirm={() => { setShowConfirm(false); signOut(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 16,
    justifyContent: "flex-start",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  nav: {
    flex: 1,
    gap: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: Radius.md,
  },
  navItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.textSecondary,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: Radius.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.danger + "30",
    backgroundColor: Colors.dangerLight,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.danger,
  },
});
