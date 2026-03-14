import { AppRegistry, Platform } from "react-native";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import WebLayout from "./src/components/WebLayout";
import { Analytics } from "@vercel/analytics/react";
import LoginScreen from "./src/screens/Loginscreen";
import RequestAccessScreen from "./src/screens/RequestAccessScreen";
import HomeScreen from "./src/screens/HomeScreen";
import UploadScreen from "./src/screens/UploadScreen";
import PDFDetailScreen from "./src/screens/PDFDetailScreen";
import CreatePDFScreen from "./src/screens/CreatePDFScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen"; // ✅ Fixed: was missing
import AdminScreen from "./src/screens/AdminScreen"; // ✅ Fixed: was missing


enableScreens();
console.log("App.js loaded ✅");

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { token } = useAuth();

  return (
    <WebLayout>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: "#6366f1" },
                headerTintColor: "#fff",
                title: "📄 PDF Share",
              }}
            />
            <Stack.Screen
              name="Upload"
              component={UploadScreen}
              options={{ headerShown: true, title: "Upload PDF" }}
            />
            <Stack.Screen
              name="CreatePDF"
              component={CreatePDFScreen}
              options={{ headerShown: true, title: "Create PDF" }}
            />
            <Stack.Screen
              name="PDFDetail"
              component={PDFDetailScreen}
              options={{ headerShown: true, title: "PDF Details" }}
            />
            <Stack.Screen
              name="ChangePassword"
              component={ChangePasswordScreen}
              options={{ headerShown: true, title: "Change Password" }}
            />
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ headerShown: true, title: "🔐 Admin Panel" }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="RequestAccess" component={RequestAccessScreen} />
          </>
        )}
      </Stack.Navigator>
    </WebLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      {Platform.OS === "web" && <Analytics />}
    </AuthProvider>
  );
}

AppRegistry.registerComponent("main", () => App);

export default App;