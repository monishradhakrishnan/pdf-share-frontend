import { AppRegistry } from "react-native";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import WebLayout from "./src/components/WebLayout";
import { Analytics } from "@vercel/analytics/next"
import LoginScreen from "./src/screens/Loginscreen";
import SignupScreen from "./src/screens/SignupScreen";
import RequestAccessScreen from "./src/screens/RequestAccessScreen";
import HomeScreen from "./src/screens/HomeScreen";
import UploadScreen from "./src/screens/UploadScreen";
import PDFDetailScreen from "./src/screens/PDFDetailScreen";
import CreatePDFScreen from "./src/screens/CreatePDFScreen";
import AdminScreen from "./src/screens/AdminScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";


enableScreens();
console.log("App.js loaded ✅");

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { token } = useAuth();

  if (!token) {
    return (
      <WebLayout>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="RequestAccess" component={RequestAccessScreen} />
        </Stack.Navigator>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: "#6366f1" }, headerTintColor: "#fff" }}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "📄 PDF Share" }} />
        <Stack.Screen name="Upload" component={UploadScreen} options={{ title: "Upload PDF" }} />
        <Stack.Screen name="CreatePDF" component={CreatePDFScreen} options={{ title: "Create PDF" }} />
        <Stack.Screen name="PDFDetail" component={PDFDetailScreen} options={{ title: "PDF Details" }} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: "Change Password" }} />
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: "🔐 Admin Panel" }} />
      </Stack.Navigator>
    </WebLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
         <Analytics />
      </NavigationContainer>
    </AuthProvider>
  );
}

AppRegistry.registerComponent("main", () => App);

export default App;