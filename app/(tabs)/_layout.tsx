import { Tabs } from "expo-router";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import WebSidebar from "../../components/WebSidebar";

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
      name="index"
      options={{
        title: "Reçete",
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name="document-scanner" focused={focused} color={color} />
        ),
      }}
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

  if (showSidebar) {
    return (
      <View style={styles.webContainer}>
        <WebSidebar />
        <View style={styles.webContent}>
          <Tabs
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

  return (
    <Tabs
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

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.background,
  },
  webContent: {
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
