// src/screens/HistoricoScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Alert, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { query, run, calcularTotalComanda } from '../db';
import { money, todayISO } from '../utils/format';

export default function HistoricoScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const iso = useMemo(() => todayISO(selectedDate), [selectedDate]);

  const [filtro, setFiltro] = useState('');
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [comandas, setComandas] = useState([]);

  const carregar = useCallback(() => {
    let rows;
    if (mostrarTodas) {
      rows = query(`
        SELECT id, nome, status, closed_at, pago
        FROM comandas
        WHERE status='fechada'
        ORDER BY closed_at DESC, lower(nome) ASC
      `);
    } else {
      rows = query(`
        SELECT id, nome, status, closed_at, pago
        FROM comandas
        WHERE status='fechada' AND substr(closed_at,1,10)=?
        ORDER BY lower(nome) ASC
      `, [iso]);
    }
    const withTotals = rows.map(c => ({ ...c, total: calcularTotalComanda(c.id) }));
    setComandas(withTotals);
  }, [iso, mostrarTodas]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', carregar);
    return unsub;
  }, [navigation, carregar]);

  useEffect(() => { carregar(); }, [iso, mostrarTodas, carregar]);

  const onChangeDate = (_e, date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  // 👉 NOVO: editar sem reabrir
  const editarFechada = (id) => {
    navigation.navigate('EditarFechada', { comandaId: id });
  };

  const removerComanda = (id, nome) => {
    Alert.alert('Remover comanda', `Excluir "${nome}" e todos os itens?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: () => {
          run("DELETE FROM itens WHERE comanda_id=?", [id]);
          run("DELETE FROM comandas WHERE id=?", [id]);
          carregar();
        }
      }
    ]);
  };

  const alternarPago = (id, pagoAtual) => {
    const novo = pagoAtual === 1 ? 0 : 1;
    run("UPDATE comandas SET pago=? WHERE id=?", [novo, id]);
    carregar();
  };

  const dataFiltrada = comandas.filter(c =>
    c.nome?.toLowerCase().includes(filtro.trim().toLowerCase())
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>Histórico de Comandas</Text>

      <View style={styles.row}>
        <Pressable style={styles.dateChip} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateChipText}>{iso}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSec]} onPress={() => setMostrarTodas(false)}>
          <Text style={styles.btnText}>Somente dia</Text>
        </Pressable>
        <Pressable style={[styles.btn, mostrarTodas ? styles.btnOn : styles.btnOff]} onPress={() => setMostrarTodas(true)}>
          <Text style={styles.btnText}>Todas</Text>
        </Pressable>
      </View>

      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onChangeDate}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Buscar por nome..."
        value={filtro}
        onChangeText={setFiltro}
      />

      <FlatList
        data={dataFiltrada}
        keyExtractor={(i) => String(i.id)}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#777', marginTop: 20 }}>
          {mostrarTodas ? 'Nenhuma comanda fechada encontrada.' : 'Nenhuma comanda fechada neste dia.'}
        </Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text style={styles.meta}>
                {item.closed_at ? item.closed_at : '—'} • {item.pago === 1 ? 'Pago' : (item.pago === 0 ? 'Não pago' : '—')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.total}>{money(item.total)}</Text>

              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {/* 👉 botão Editar agora leva para EditarFechada (não reabre) */}
                <Pressable onPress={() => editarFechada(item.id)} style={[styles.smallBtn, { backgroundColor: '#1976d2' }]}>
                  <Text style={styles.smallBtnText}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => alternarPago(item.id, item.pago)} style={[styles.smallBtn, { backgroundColor: '#6a1b9a' }]}>
                  <Text style={styles.smallBtnText}>{item.pago === 1 ? 'Marcar não pago' : 'Marcar pago'}</Text>
                </Pressable>
                {/* Mostrar QR Pix somente se NÃO pago */}
                {item.pago !== 1 && (
                  <Pressable
                    on pressRetentionOffset={() => navigation.navigate('Pix', {comandaId: item.id })}
                    syte={[styles.masllBtn, { backgroundColor: '#oo9688'}]}
                    >
                      <Text sytle={styles.smallBtnText}>Mostrar QR Pix</Text>
                  </Pressable>
                )}

                <Pressable onPress={() => removerComanda(item.id, item.nome)} style={[styles.smallBtn, { backgroundColor: '#c62828' }]}>
                  <Text style={styles.smallBtnText}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  dateChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, minWidth: 140, alignItems: 'center' },
  dateChipText: { fontWeight: '600', color: '#333' },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnSec: { backgroundColor: '#455a64' },
  btnOn: { backgroundColor: '#2e7d32' },
  btnOff: { backgroundColor: '#bdbdbd' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#fff', color: '#111' },
  card: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome: { fontSize: 16, fontWeight: 'bold' },
  meta: { color: '#666', marginTop: 2 },
  total: { fontSize: 16, fontWeight: 'bold' },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  smallBtnText: { color: '#fff', fontWeight: 'bold' }
});
