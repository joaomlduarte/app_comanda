import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { run } from '../db';

export default function CriarComandaScreen({ navigation }) {
  const [nome, setNome] = useState('');

  const criar = () => {
    const n = nome.trim();
    if (!n) {
      Alert.alert('Atenção', 'Informe um nome para a comanda.');
      return;
    }
    const res = run("INSERT INTO comandas (nome, status) VALUES (?, 'aberta')", [n]);
    setNome('');
    navigation.navigate('EditarComanda', { comandaId: res.lastInsertRowId });
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>Criar Comanda</Text>
      <Text style={{ color: '#666', marginBottom: 8 }}>
        Digite um nome (ex.: cliente, mesa, apelido) e crie a comanda.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Nome da comanda"
        // placeholderTextColor vem global, mas se quiser reforçar: placeholderTextColor="#9E9E9E"
        value={nome}
        onChangeText={setNome}
      />
      <Pressable style={styles.btn} onPress={criar}>
        <Text style={styles.btnText}>Criar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  // >>> Input branco + texto escuro
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#fff', color: '#111' },
  btn: { backgroundColor: '#1976d2', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});
