import { Tabs } from "expo-router";
import { View, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Colors } from "../../constants/Colors";
import WebSidebar from "../../components/WebSidebar";

// Exact tab order used on both sidebar and mobile web bar
const TAB_ITEMS = [
  { name: "home",          icon: "dashboard"        as keyof typeof MaterialIcons.glyphMap },
  { name: "prescriptions", icon: "document-scanner" as keyof typeof MaterialIcons.glyphMap },
  { name: "cabinet",       icon: "medical-services" as keyof typeof MaterialIcons.glyphMap },
  { name: "active",        icon: "alarm"            as keyof typeof MaterialIcons.glyphMap },
  { name: "calendar",      icon: "calendar-month"   as keyof typeof MaterialIcons.glyphMap },
  { name: "vaccines",      icon: "vaccines"         as keyof typeof MaterialIcons.glyphMap },
  { name: "chat",          icon: "chat"             as keyof typeof MaterialIcons.glyphMap },
  { name: "profile",       icon: "person"           as keyof typeof MaterialIcons.glyphMap },
];

// Custom bottom bar for mobile web — renders icons the same way WebSidebar does (works)
function MobileWebTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={mobileBarStyles.bar}>
      {TAB_ITEMS.map((tab) => {
        const active = pathname === `/${tab.name}` || pathname.endsWith(`/${tab.name}`);
        return (
          <TouchableOpacity
            key={tab.name}
            style={[mobileBarStyles.tab, active && mobileBarStyles.tabActive]}
            onPress={() => router.push(`/(tabs)/${tab.name}` as any)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={tab.icon}
              size={24}
              color={active ? Colors.tabBarActive : Colors.tabBarInactive}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TabIcon({
  name,
  focused,
  color,
}: {
  name: keyof typeof MaterialIcons.glyphMap;
  focused: boolean;
  color: string;
}) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <MaterialIcons name={name} size={22} color={color} />
    </View>
  );
}

const tabScreens = (
  <>
    <Tabs.Screen
      name="home"
      options={{
        title: "Ana Sayfa",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="dashboard" focused={focused} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="prescriptions"
      options={{
        title: "Reçete",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="document-scanner" focused={focused} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="index"
      options={{ href: null }}
    />
    <Tabs.Screen
      name="cabinet"
      options={{
        title: "Dolabım",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="medical-services" focused={focused} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="active"
      options={{
        title: "Takip",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="alarm" focused={focused} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="calendar"
      options={{
        title: "Takvim",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="calendar-month" focused={focused} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="vaccines"
      options={{
        title: "Aşı Kartı",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="vaccines" focused={focused} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="chat"
      options={{
        title: "Asistan",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="chat" focused={focused} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="profile"
      options={{
        title: "Profil",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="person" focused={focused} color={color} />
        ),
      }}
    />
  </>
);

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const showSidebar = Platform.OS === "web" && width >= 768;
  const isMobileWeb = Platform.OS === "web" && width < 768;

  if (showSidebar) {
    return (
      <View style={styles.webContainer}>
        <WebSidebar />
        <View style={styles.webContent}>
          <Tabs
            initialRouteName="home"
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: "none" },
            }}
          >
            {tabScreens}
          </Tabs>
        </View>
      </View>
    );
  }

  if (isMobileWeb) {
    return (
      <View style={styles.mobileWebContainer}>
        <View style={styles.mobileWebContent}>
          <Tabs
            initialRouteName="home"
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: "none" },
            }}
          >
            {tabScreens}
          </Tabs>
        </View>
        <MobileWebTabBar />
      </View>
    );
  }

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarShowLabel: true,
        tabBarPosition: "bottom",
      }}
    >
      {tabScreens}
    </Tabs>
  );
}

const mobileBarStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: Colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    height: 56,
    alignItems: "center",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: Colors.tabBarActive,
  },
});

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.background,
  },
  webContent: {
    flex: 1,
  },
  mobileWebContainer: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: Colors.background,
  },
  mobileWebContent: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: Colors.tabBar,
    borderTopColor: Colors.tabBarBorder,
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 88 : 64,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  iconWrapperActive: {
    backgroundColor: Colors.primaryLight,
  },
});
