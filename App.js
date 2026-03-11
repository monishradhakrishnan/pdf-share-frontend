import { AppRegistry } from "react-native";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import WebLayout from "./src/components/WebLayout";
import LoginScreen from "./src/screens/Loginscreen";
import SignupScreen from "./src/screens/SignupScreen";
import HomeScreen from "./src/screens/HomeScreen";
import UploadScreen from "./src/screens/UploadScreen";
import PDFDetailScreen from "./src/screens/PDFDetailScreen";
import CreatePDFScreen from "./src/screens/CreatePDFScreen";

enableScreens();
console.log("App.js loaded ✅");

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { token } = useAuth();
  return (
    // WebLayout is now INSIDE NavigationContainer so navigation is ready
    <WebLayout>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#6366f1" },
          headerTintColor: "#fff",
        }}
      >
        {!token ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: "📄 PDF Share" }} />
            <Stack.Screen name="Upload" component={UploadScreen} options={{ title: "Upload PDF" }} />
            <Stack.Screen name="CreatePDF" component={CreatePDFScreen} options={{ title: "Create PDF" }} />
            <Stack.Screen name="PDFDetail" component={PDFDetailScreen} options={{ title: "PDF Details" }} />
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
    </AuthProvider>
  );
}

AppRegistry.registerComponent("main", () => App);

export default App;