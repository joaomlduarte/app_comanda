// src/screens/HistoricoScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Alert, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { query, run, calcularTotalComanda } from '../db';
import { money, todayISO } from '../utils/format';

function fmtDateTime(sql) {
  if (!sql) return '—';
  return String(sql).replace('T', ' ').slice(0, 16); // yyyy-mm-dd HH:MM
}

export default function HistoricoScreen({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const iso = useMemo(() => todayISO(selectedDate), [selectedDate]);

  const [filtro, setFiltro] = useState('');
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [comandas, setComandas] = useState([]);

  const carregar = useCallback(() => {
    const baseSelect = `
      SELECT id, nome, status, closed_at, pago, metodo_pagto
      FROM comandas
      WHERE status='fechada'
    `;

    const rows = mostrarTodas
      ? query(`${baseSelect} ORDER BY closed_at DESC, lower(nome) ASC`)
      : query(
          `${baseSelect} AND substr(closed_at,1,10)=? ORDER BY lower(nome) ASC`,
          [iso]
        );

    const withTotals = (rows || []).map(c => ({ ...c, total: calcularTotalComanda(c.id) }));
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

  // editar sem reabrir
  const editarFechada = (id) => {
    navigation.navigate('EditarFechada', { comandaId: id });
  };

  const removerComanda = (id, nome) => {
    Alert.alert('Remover comanda', `Excluir "${nome}" e todos os itens?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: () => {
          run('DELETE FROM itens WHERE comanda_id=?', [id]);
          run('DELETE FROM comandas WHERE id=?', [id]);
          carregar();
        }
      }
    ]);
  };

  const alternarPago = (id, pagoAtual) => {
    const novo = pagoAtual === 1 ? 0 : 1;
    // se marcar pago manualmente, gravar metodo_pagto='manual'; se desmarcar, NULL
    run('UPDATE comandas SET pago=?, metodo_pagto=? WHERE id=?', [novo, novo ? 'manual' : null, id]);
    carregar();
  };

  const statusLabel = (row) => {
    if (row?.metodo_pagto === 'pix') return 'Pago (PIX)';
    return row?.pago === 1 ? 'Pago' : 'Não pago';
  };

  const dataFiltrada = comandas.filter(c =>
    (c.nome || '').toLowerCase().includes(filtro.trim().toLowerCase())
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {/* Cabeçalho do card */}
      <View style={styles.cardHeader}>
        <View style={styles.leftWrap}>
          <Text style={styles.nome} numberOfLines={1} ellipsizeMode="tail">
            {item.nome || '—'}
          </Text>
          <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
            {fmtDateTime(item.closed_at)} • {statusLabel(item)}
          </Text>
        </View>

        <Text style={styles.valor} numberOfLines={1}>
          {money(item.total)}
        </Text>
      </View>

      {/* Ações */}
      <View style={styles.actions}>
        <Pressable onPress={() => editarFechada(item.id)} style={[styles.smallBtn, styles.btnBlue]}>
          <Text style={styles.smallBtnText}>Editar</Text>
        </Pressable>

        <Pressable onPress={() => alternarPago(item.id, item.pago)} style={[styles.smallBtn, styles.btnPurple]}>
          <Text style={styles.smallBtnText}>{item.pago === 1 ? 'Marcar não pago' : 'Marcar pago'}</Text>
        </Pressable>

        {/* Mostrar QR Pix somente se NÃO estiver pago manualmente.
           Se já foi pago via PIX (metodo_pagto='pix'), você pode ocultar também se preferir */}
        {item.pago !== 1 && (
          <Pressable onPress={() => navigation.navigate('Pix', { comandaId: item.id })} style={[styles.smallBtn, styles.btnGrey]}>
            <Text style={styles.smallBtnText}>Mostrar QR Pix</Text>
          </Pressable>
        )}

        <Pressable onPress={() => removerComanda(item.id, item.nome)} style={[styles.smallBtn, styles.btnRed]}>
          <Text style={styles.smallBtnText}>Excluir</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>Histórico de Comandas</Text>

      <View style={styles.row}>
        <Pressable style={styles.dateChip} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateChipText}>{iso}</Text>
        </Pressable>

        <Pressable
          style={[styles.btnToggle, !mostrarTodas ? styles.toggleOn : styles.toggleOff]}
          onPress={() => setMostrarTodas(false)}
        >
          <Text style={styles.btnToggleText(!mostrarTodas)}>Somente dia</Text>
        </Pressable>

        <Pressable
          style={[styles.btnToggle, mostrarTodas ? styles.toggleOn : styles.toggleOff]}
          onPress={() => setMostrarTodas(true)}
        >
          <Text style={styles.btnToggleText(mostrarTodas)}>Todas</Text>
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
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#777', marginTop: 20 }}>
            {mostrarTodas ? 'Nenhuma comanda fechada encontrada.' : 'Nenhuma comanda fechada neste dia.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },

  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  dateChip: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 14, minWidth: 140, alignItems: 'center'
  },
  dateChipText: { fontWeight: '600', color: '#333' },

  btnToggle: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  toggleOn: { backgroundColor: '#37474f' },
  toggleOff: { backgroundColor: '#cfd8dc' },
  btnToggleText: (on) => ({ color: on ? '#fff' : '#333', fontWeight: '700' }),

  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff',
    marginBottom: 10, color: '#111'
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#eee',
    padding: 12,
    marginBottom: 12
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },

  leftWrap: {
    flex: 1,
    minWidth: 0,      // ESSENCIAL para truncar o texto ao invés de quebrar por letra
    paddingRight: 8,
  },

  nome: { fontSize: 18, fontWeight: '700', color: '#111' },
  sub:  { color: '#666', marginTop: 2 },

  valor: { fontSize: 18, fontWeight: '800', color: '#111', flexShrink: 0 },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 10
  },

  smallBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontWeight: 'bold' },

  btnBlue:   { backgroundColor: '#1976d2' },
  btnPurple: { backgroundColor: '#6a1b9a' },
  btnRed:    { backgroundColor: '#d32f2f' },
  btnGrey:   { backgroundColor: '#607d8b' },
});
