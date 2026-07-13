import { Tabs } from "expo-router";
import { View, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

// NOT: Tabs bileşeninin çocukları tek tek <Tabs.Screen> olmalı — bunları bir
// Fragment (<>...</>) içine sarıp tek bir değişken olarak geçmek, expo-router'ın
// "Layout children must be of type Screen" uyarısıyla TÜM seçenekleri (başlık,
// ikon, href:null) yok sayıp dosya bazlı varsayılanlara düşmesine yol açıyordu.
// Düz bir dizi (her elemanda key ile) kullanmak React tarafından doğru şekilde
// ayrı kardeşler olarak açılıyor.
const tabScreens = [
  <Tabs.Screen
    key="home"
    name="home"
    options={{
      title: "Ana Sayfa",
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
        <TabIcon name="dashboard" focused={focused} color={color} />
      ),
    }}
  />,
  <Tabs.Screen key="index" name="index" options={{ href: null }} />,
  <Tabs.Screen
    key="active"
    name="active"
    options={{
      title: "Takip",
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
        <TabIcon name="alarm" focused={focused} color={color} />
      ),
    }}
  />,
  <Tabs.Screen
    key="prescriptions"
    name="prescriptions"
    options={{
      title: "Reçete",
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
        <TabIcon name="document-scanner" focused={focused} color={color} />
      ),
    }}
  />,
  <Tabs.Screen
    key="cabinet"
    name="cabinet"
    options={{
      title: "Dolabım",
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
        <TabIcon name="medical-services" focused={focused} color={color} />
      ),
    }}
  />,
  <Tabs.Screen
    key="calendar"
    name="calendar"
    options={{
      title: "Takvim",
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
        <TabIcon name="calendar-month" focused={focused} color={color} />
      ),
    }}
  />,
  <Tabs.Screen
    key="chat"
    name="chat"
    options={{
      title: "Asistan",
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
        <TabIcon name="chat" focused={focused} color={color} />
      ),
    }}
  />,
  // Deneme: Profil artık alt tab bar'da değil, her ekranın sağ üstünde küçük
  // bir ikon olarak duruyor (bkz. HeaderProfileButton) — bottom bar 6 sekmeye
  // düştü. href:null sadece native bottom bar'ı etkiliyor; web sidebar ve
  // mobil web bar'ı (kendi ayrı listeleriyle) bundan etkilenmiyor.
  <Tabs.Screen key="profile" name="profile" options={{ href: null }} />,
];

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
        tabBarStyle: [
          styles.tabBar,
          {
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom + 8,
          },
        ],
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
    paddingTop: 8,
    // height/paddingBottom TabsLayout içinde useSafeAreaInsets ile
    // dinamik olarak ekleniyor (Android gesture bar/geri çubuğuyla
    // çakışmasın diye).
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
