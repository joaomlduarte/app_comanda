import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
// API legada do FileSystem no SDK 54
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';
import { query } from '../db';
import { todayISO } from '../utils/format';

export default function ExportarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const iso = useMemo(() => todayISO(selectedDate), [selectedDate]);

  const onChangeDate = (_event, date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  const setHoje = () => setSelectedDate(new Date());
  const setOntem = () => { const d = new Date(); d.setDate(d.getDate() - 1); setSelectedDate(d); };

  const exportar = async () => {
    try {
      // Busca também c.metodo_pagto
      const rows = query(
        `
        SELECT 
          c.id                 AS comanda_id,
          c.nome               AS comanda_nome,
          c.closed_at,
          c.pago,
          c.metodo_pagto,                -- 'pix' | 'manual' | NULL
          i.quantidade,
          i.preco_unit,
          COALESCE(p.nome, i.descricao)  AS item_nome
        FROM comandas c
        JOIN itens i   ON i.comanda_id = c.id
        LEFT JOIN produtos p ON p.id = i.produto_id
        WHERE c.status='fechada' AND substr(c.closed_at,1,10) = ?
        ORDER BY lower(c.nome) ASC, c.id ASC, i.id ASC
      `,
        [iso]
      );

      if (!rows.length) {
        Alert.alert('Sem dados', `Nenhuma comanda fechada em ${iso}.`);
        return;
      }

      // Planilha
      const header = ['Comanda', 'Situação', 'Item', 'Qtd', 'Unitário', 'Subtotal'];
      const aoa = [['Data', iso], [], header];

      let totalDia = 0;
      rows.forEach((r) => {
        // Se método = PIX, sempre marcar “pago (pix)”
        const situacao =
          r?.metodo_pagto === 'pix'
            ? 'pago (pix)'
            : (r?.pago === 1 ? 'pago' : 'não pago');

        const qtd  = Number(r.quantidade) || 0;
        const unit = Number(r.preco_unit) || 0;
        const subtotal = qtd * unit;
        totalDia += subtotal;

        aoa.push([r.comanda_nome, situacao, r.item_nome, qtd, unit, subtotal]);
      });

      aoa.push([]);
      aoa.push(['TOTAL DO DIA', '', '', '', totalDia]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Formatação numérica (C=Qtd, D=Unitário, E=Subtotal -> 0-based: 3,4,5)
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = 3; R <= range.e.r - 2; ++R) {
        const cQtd  = XLSX.utils.encode_cell({ r: R, c: 3 });
        const cUnit = XLSX.utils.encode_cell({ r: R, c: 4 });
        const cSubt = XLSX.utils.encode_cell({ r: R, c: 5 });
        if (!ws[cQtd])  ws[cQtd]  = { t: 'n', v: 0 };
        if (!ws[cUnit]) ws[cUnit] = { t: 'n', v: 0 };
        if (!ws[cSubt]) ws[cSubt] = { t: 'n', v: 0 };
        ws[cQtd].z  = '0';
        ws[cUnit].z = '0.00';
        ws[cSubt].z = '0.00';
      }
      const lastRow = range.e.r;
      const totalCell = XLSX.utils.encode_cell({ r: lastRow, c: 5 });
      if (ws[totalCell]) ws[totalCell].z = '0.00';

      XLSX.utils.book_append_sheet(wb, ws, 'Resumo');

      // Gera arquivo .xlsx (Base64)
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = `resumo_${iso}.xlsx`;
      const fileUri = FileSystem.cacheDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' });

      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists) {
        Alert.alert('Erro', 'Falha ao salvar o arquivo XLSX.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Arquivo gerado', `Salvo em cache:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
        dialogTitle: `Abrir “${filename}” com...`,
      });
    } catch (err) {
      console.error('[EXPORT XLS ERROR]', err);
      Alert.alert('Erro ao exportar', String(err?.message ?? err));
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>Exportar Resumo do Dia</Text>

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

      <Pressable onPress={exportar} style={[styles.btn, { alignSelf: 'flex-start', marginTop: 8 }]}>
        <Text style={styles.btnText}>Exportar XLSX</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  dateChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, minWidth: 140, alignItems: 'center' },
  dateChipText: { fontWeight: '600', color: '#333' },
  btn: { backgroundColor: '#2e7d32', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnSec: { backgroundColor: '#455a64' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
