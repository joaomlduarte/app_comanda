// App.js — Tabs com ícones + tema claro fixo
import 'react-native-gesture-handler';
import './src/shims';
import React, { useEffect, useState } from 'react';
import { Platform, View, Text, Linking, Pressable, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import DashboardScreen from './src/screens/DashboardScreen';
import ComandasListScreen from './src/screens/ComandasListScreen';
import NovaComandaScreen from './src/screens/NovaComandaScreen';   // editar
import ProdutosScreen from './src/screens/ProdutosScreen';
import ExportarScreen from './src/screens/ExportarScreen';
import CriarComandaScreen from './src/screens/CriarComandaScreen'; // criar
import { initDb } from './src/db';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const isWeb = Platform.OS === 'web';

// Tema claro para o React Navigation
const LightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1976d2',
    background: '#ffffff',
    card: '#ffffff',
    text: '#111111',
    border: '#e5e5e5',
    notification: '#1976d2',
  },
};

function WebNotice() {
  return (
    <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}>
        Este app usa banco local (SQLite), indisponível no Web.
      </Text>
      <Text style={{ textAlign: 'center', color: '#555' }}>
        Rode no Android com o app "Expo Go".
      </Text>
      <Pressable
        style={{ backgroundColor: '#1976d2', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
        onPress={() => Linking.openURL('https://expo.dev/client')}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Instalar Expo Go</Text>
      </Pressable>
    </View>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" />
      <Text>Inicializando banco local...</Text>
    </View>
  );
}

// Stack interno da aba Comandas (listar -> criar/editar)
function ComandasStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ComandasList" component={ComandasListScreen} options={{ title: 'Comandas' }} />
      <Stack.Screen name="CriarComanda" component={CriarComandaScreen} options={{ title: 'Criar Comanda' }} />
      <Stack.Screen name="EditarComanda" component={NovaComandaScreen} options={{ title: 'Editar Comanda' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isWeb) return;
    try {
      initDb();
      setReady(true);
    } catch (e) {
      console.error('[DB INIT ERROR]', e);
    }
  }, []);

  if (isWeb) return <WebNotice />;
  if (!ready) return <Loading />;

  return (
    <NavigationContainer theme={LightTheme}>
      {/* StatusBar sempre clara (texto escuro) */}
      <StatusBar style="dark" backgroundColor="#ffffff" />

      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: true,
          tabBarActiveTintColor: '#1976d2',
          tabBarInactiveTintColor: '#9e9e9e',
          tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5e5e5' },
          // Ícones por aba
          tabBarIcon: ({ color, size }) => {
            switch (route.name) {
              case 'Dashboard':
                return <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />;
              case 'Comandas':
                return <MaterialCommunityIcons name="clipboard-text-outline" size={size} color={color} />;
              case 'Produtos':
                return <MaterialCommunityIcons name="tag-outline" size={size} color={color} />;
              case 'Exportar':
                return <MaterialCommunityIcons name="file-excel" size={size} color={color} />;
              default:
                return null;
            }
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        {/* A aba Comandas renderiza o Stack e esconde o header do Tab nessa rota */}
        <Tab.Screen
          name="Comandas"
          component={ComandasStack}
          options={{ headerShown: false }}
        />
        <Tab.Screen name="Produtos" component={ProdutosScreen} />
        <Tab.Screen name="Exportar" component={ExportarScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
