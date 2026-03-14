import React from "react";
import { View, Text, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function WebLayout({ children }) {
  if (Platform.OS !== "web") return children;

  const { width } = useWindowDimensions();
  const { token } = useAuth();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  const showSidebar = !isMobile && !!token;

  return (
    <View style={s.outer}>
      {showSidebar && (
        <View style={[s.sidebar, isTablet && s.sidebarTablet]}>
          <View>
            <Text style={s.logo}>📄 PDF Share</Text>
            <Text style={s.tagline}>Your documents, anywhere.</Text>
          </View>
          <View style={s.features}>
            <Feature icon="📤" title="Upload PDFs"      desc="Store and manage your documents securely in the cloud." />
            <Feature icon="👤" title="Share with Users" desc="Share files with others using custom time limits." />
            <Feature icon="⏱" title="Auto Expiry"       desc="Files automatically disappear after your set time." />
            <Feature icon="🖨" title="Print Anywhere"   desc="Print directly from any device or browser." />
          </View>
          <Text style={s.footerTxt}>© 2026 PDF Share. All rights reserved.</Text>
        </View>
      )}

      <View style={[
        s.appContainer,
        isMobile && s.appFull,
        isTablet && s.appTablet,
        !isMobile && !isTablet && s.appDesktop,
      ]}>
        {children}
      </View>
    </View>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <View style={s.feature}>
      <Text style={s.featureIcon}>{icon}</Text>
      <View style={s.featureText}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    minHeight: "100vh",
  },
  sidebar: {
    width: 340,
    backgroundColor: "#6366f1",
    padding: 48,
    justifyContent: "space-between",
  },
  sidebarTablet: {
    width: 260,
    padding: 32,
  },
  logo: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  features: {
    flex: 1,
    justifyContent: "center",
  },
  feature: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 14,
    marginTop: 2,
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
  },
  footerTxt: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  appContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    overflow: "visible",
  },
  appFull: {
    width: "100%",
  },
  appTablet: {
    flex: 1,
  },
  appDesktop: {
    flex: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
});
