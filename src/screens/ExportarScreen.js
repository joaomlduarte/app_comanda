import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { query } from '../db';
import { todayISO } from '../utils/format';

export default function ExportarScreen() {
  const [data, setData] = useState('');

  const usarHoje = () => setData(todayISO(new Date()));

  const exportar = async () => {
    const d = data.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert('Data inválida', 'Use o formato YYYY-MM-DD (ex: 2025-09-18).');
      return;
    }

    const rows = query(`
      SELECT c.id as comanda_id, c.nome as comanda_nome, c.closed_at,
             i.quantidade, i.preco_unit,
             COALESCE(p.nome, i.descricao) as item_nome
      FROM comandas c
      JOIN itens i ON i.comanda_id = c.id
      LEFT JOIN produtos p ON p.id = i.produto_id
      WHERE c.status='fechada' AND date(c.closed_at) = date(?)
      ORDER BY c.nome ASC, c.id ASC
    `, [d]);

    if (rows.length === 0) {
      Alert.alert('Sem dados', 'Nenhuma comanda fechada neste dia.');
      return;
    }

    const sheetData = [
      ['Data', d],
      [],
      ['Comanda', 'Item', 'Qtd', 'Unitário', 'Subtotal']
    ];
    let totalDia = 0;
    rows.forEach(r => {
      const subtotal = r.quantidade * r.preco_unit;
      totalDia += subtotal;
      sheetData.push([r.comanda_nome, r.item_nome, r.quantidade, r.preco_unit, subtotal]);
    });
    sheetData.push([]);
    sheetData.push(['TOTAL DO DIA', '', '', '', totalDia]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const fileUri = FileSystem.cacheDirectory + `resumo_${d}.xlsx`;
    await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>Exportar Resumo do Dia</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={data}
        onChangeText={setData}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={usarHoje} style={[styles.btn, { backgroundColor: '#616161' }]}>
          <Text style={styles.btnText}>Hoje</Text>
        </Pressable>
        <Pressable onPress={exportar} style={styles.btn}>
          <Text style={styles.btnText}>Exportar XLS</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  btn: { backgroundColor: '#2e7d32', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
