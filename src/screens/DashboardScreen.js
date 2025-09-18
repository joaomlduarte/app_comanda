// src/screens/DashboardScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { faturamentoDoDia } from '../db';
import { money, todayISO } from '../utils/format';
import { onComandaFechada } from '../utils/events';

export default function DashboardScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const iso = useMemo(() => todayISO(selectedDate), [selectedDate]);
  const [total, setTotal] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  const recalc = useCallback(() => {
    setTotal(faturamentoDoDia(iso));
  }, [iso]);

  // Recalcula ao focar a aba
  useFocusEffect(
    useCallback(() => {
      recalc();
    }, [recalc])
  );

  // Recalcula quando alguma comanda é fechada
  useEffect(() => {
    const off = onComandaFechada(() => recalc());
    return off;
  }, [recalc]);

  // Recalcula quando muda a data
  useEffect(() => {
    recalc();
  }, [iso, recalc]);

  const onChangeDate = (_event, date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  const setHoje = () => setSelectedDate(new Date());
  const setOntem = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Faturamento</Text>

      <View style={styles.row}>
        <Pressable style={styles.dateChip} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateChipText}>{iso}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSec]} onPress={setOntem}>
          <Text style={styles.btnText}>Ontem</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={setHoje}>
          <Text style={styles.btnText}>Hoje</Text>
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

      <Text style={styles.value}>{money(total)}</Text>
      <Text style={styles.hint}>Somatório das comandas fechadas na data selecionada.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 },
  dateChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, minWidth: 140, alignItems: 'center' },
  dateChipText: { fontWeight: '600', color: '#333' },
  btn: { backgroundColor: '#1976d2', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnSec: { backgroundColor: '#455a64' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  value: { fontSize: 36, fontWeight: '900' },
  hint: { marginTop: 8, color: '#666', textAlign: 'center' },
});
