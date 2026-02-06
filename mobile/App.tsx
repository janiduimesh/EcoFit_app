import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Logo from './app/screens/Logo';
import Main from './app/screens/Main';
import Home from './app/screens/Home';
import WasteCheck from './app/screens/WasteCheck';
import Result from './app/screens/Result';
import Login from './app/screens/Login';
import Register from './app/screens/Register';
import Tax from './app/screens/Tax';
import CreateHousehold from './app/screens/CreateHousehold';
import Tax_Portal from './app/screens/Tax_Portal';
import Dashboard from './app/screens/Dashboard';


type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  Login: undefined;
  Register: undefined;
  WasteCheck: undefined;
  Result: { data: any };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName="Logo"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#4CAF50',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Logo"
          component={Logo}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={Register}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Main"
          component={Main}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={Home}
          options={{ title: 'Check Waste Type' }}
        />
        <Stack.Screen
          name="WasteCheck"
          component={WasteCheck}
          options={{ title: 'Check Waste Type' }}
        />

        <Stack.Screen
        name="Tax"
        component={Tax}
        options={{ title: 'Check Tax' }}
        />
        <Stack.Screen
  name="CreateHousehold"
  component={CreateHousehold}
  options={{ title: 'Create Household' }}
/>

<Stack.Screen
          name="Tax_Portal"
          component={Tax_Portal}
          options={{ title: 'Tax' }}
        />

        <Stack.Screen
          name="Dashboard"
          component={Dashboard}
          options={{ title: 'Dashboard' }}
        />

        <Stack.Screen
          name="Result"
          component={Result}
          options={{ title: 'Results' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
