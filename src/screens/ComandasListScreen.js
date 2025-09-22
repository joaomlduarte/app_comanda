import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { query, run, calcularTotalComanda } from '../db';
import { emitComandaFechada } from '../utils/events';
import { nowSqlLocal } from '../utils/time';
import { money } from '../utils/format';



export default function ComandasListScreen({ navigation }) {
  const [comandas, setComandas] = useState([]);
  const [filtro, setFiltro] = useState('');

  const carregar = () => {
    const rows = query("SELECT * FROM comandas WHERE status='aberta' ORDER BY lower(nome) ASC");
    const withTotals = rows.map(c => ({ ...c, total: calcularTotalComanda(c.id) }));
    setComandas(withTotals);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', carregar);
    return unsubscribe;
  }, [navigation]);

const fechar = (id) => {
  const total = calcularTotalComanda(id);

  Alert.alert(
    'Finalizar comanda',
    'Como deseja finalizar?',
    [
      {
        text: 'PIX (QR)',
        onPress: () => {
          // fecha como NÃO pago e abre o QR
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [0, nowSqlLocal(), id]);
          emitComandaFechada({ comandaId: id, total });
          carregar();
          navigation.navigate('Pix', { comandaId: id }); // não passa total, a tela recalcula
        }
      },
      {
        text: 'Não pago',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [0, nowSqlLocal(), id]);
          emitComandaFechada({ comandaId: id, total });
          Alert.alert('Comanda fechada', `Total: ${money(total)} (Não paga)`);
          carregar();
        }
      },
      {
        text: 'Pago',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [1, nowSqlLocal(), id]);
          emitComandaFechada({ comandaId: id, total });
          Alert.alert('Comanda fechada', `Total: ${money(total)} (Paga)`);
          carregar();
        }
      },
    ],
    { cancelable: true } // permite “cancelar” tocando fora/voltar
  );
};

  const abrirParaEditar = (id) => {
    navigation.navigate('EditarComanda', { comandaId: id });
  };

  const irCriar = () => navigation.navigate('CriarComanda');
  const irDashboard = () => navigation.getParent()?.navigate('Dashboard');

  const dataFiltrada = comandas.filter(c =>
    c.nome.toLowerCase().includes(filtro.trim().toLowerCase())
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={styles.topRow}>
        <Pressable style={styles.btnNova} onPress={irCriar}>
          <Text style={styles.btnText}>+ Criar Comanda</Text>
        </Pressable>
        <Pressable style={styles.btnDash} onPress={irDashboard}>
          <Text style={styles.btnText}>Dashboard</Text>
        </Pressable>
      </View>

      <Text style={styles.counter}>Abertas agora: {comandas.length}</Text>

      <TextInput
        style={styles.input}
        placeholder="Buscar por nome..."
        // (placeholderTextColor já vem do App.js; se quiser, pode repetir aqui)
        // placeholderTextColor="#9E9E9E"
        value={filtro}
        onChangeText={setFiltro}
      />

      <FlatList
        data={dataFiltrada}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#777', marginTop: 20 }}>
            Nenhuma comanda aberta no momento.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => abrirParaEditar(item.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text style={styles.status}>Status: Aberta</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.total}>{money(item.total)}</Text>
              <Pressable onPress={() => fechar(item.id)} style={styles.btnFechar}>
                <Text style={styles.btnTextSmall}>Fechar</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  btnNova: { flex: 1, backgroundColor: '#1976d2', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnDash: { backgroundColor: '#455a64', padding: 12, borderRadius: 8, alignItems: 'center', paddingHorizontal: 16 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  counter: { fontWeight: '600', marginBottom: 10, color: '#333' },
  // >>> Input com fundo branco + texto escuro
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#fff', color: '#111' },
  card: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontSize: 18, fontWeight: 'bold' },
  status: { color: '#666', marginTop: 4 },
  total: { fontSize: 16, fontWeight: 'bold' },
  btnFechar: { marginTop: 8, backgroundColor: '#2e7d32', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnTextSmall: { color: '#fff', fontWeight: 'bold' }
});
