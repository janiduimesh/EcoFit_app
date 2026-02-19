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
import Login from './app/screens/login';
import Register from './app/screens/Register';
import AIAgent from './app/screens/AIAgent';
import Tax from './app/screens/Tax';
import Tax_Household from './app/screens/Tax_Household';

type RootStackParamList = {
  Logo: undefined;
  Main: undefined;
  Home: undefined;
  Login: undefined;
  Register: undefined;
  WasteCheck: undefined;
  AIAgent: undefined;

  Result: { data: any };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName="Login"
        // screenOptions={{
        //   headerStyle: {
        //     backgroundColor: '#4CAF50',
        //   },
        //   headerTintColor: '#fff',
        //   headerTitleStyle: {
        //     fontWeight: 'bold',
        //   },
        // }}
      >
        {/* <Stack.Screen 
          name="Logo" 
          component={Logo} 
          options={{ headerShown: false }}
        /> */}
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
          name="AIAgent" 
          component={AIAgent} 
          options={{ title: 'AI Agent' }}
        />
        <Stack.Screen 
          name="Result" 
          component={Result} 
          options={{ title: 'Results' }}
        />

         <Stack.Screen
        name="Tax"
        component={Tax}
        options={{ title: 'Check Tax' }}
        />
        <Stack.Screen
        name="Tax_Household"
        component={Tax_Household}
        options={{ title: 'Create Household' }}
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
