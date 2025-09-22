// src/screens/PixScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';

import { PIX_CONFIG } from '../config/pix';
import { buildPixPayload, sanitizeAscii } from '../utils/pix';
import { money } from '../utils/format';
import { query, calcularTotalComanda } from '../db';

export default function PixScreen({ route }) {
  const comandaId = route?.params?.comandaId;
  const [total, setTotal] = useState(0);

  // Carrega nome da comanda (opcional, só para exibir bonitinho)
  const nomeComanda = useMemo(() => {
    const c = query('SELECT nome FROM comandas WHERE id=?', [comandaId])?.[0];
    return c?.nome || `COMANDA ${comandaId}`;
  }, [comandaId]);

  // Recalcula o total SEMPRE que entrar na tela
  useFocusEffect(
    React.useCallback(() => {
      const t = comandaId ? calcularTotalComanda(comandaId) : 0;
      setTotal(t);
    }, [comandaId])
  );

  // TXID único por comanda (máx 25 chars, A-Z0-9)
  const txid = useMemo(() => {
    const base = `C${String(comandaId)}-${sanitizeAscii(nomeComanda).replace(/[^A-Z0-9]/g,'').slice(0,12)}`;
    return base.slice(0, 25);
  }, [comandaId, nomeComanda]);

  // Payload Pix “Copia e Cola” com o valor EXATO da comanda
  const payload = useMemo(() => buildPixPayload({
    key: PIX_CONFIG.key,
    name: PIX_CONFIG.name,
    city: PIX_CONFIG.city,
    amount: total,
    txid,
    message: `COMANDA ${comandaId}`
  }), [total, txid, comandaId]);

  const copiar = async () => {
    if (!total || total <= 0) {
      Alert.alert('Sem valor', 'A comanda não possui itens/valor para cobrar.');
      return;
    }
    await Clipboard.setStringAsync(payload);
    Alert.alert('Copiado', 'Código Pix (copia e cola) copiado.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pagar com Pix</Text>
      <Text style={styles.sub}>{nomeComanda}</Text>
      <Text style={styles.valor}>{money(total)}</Text>

      <View style={styles.qrBox}>
        <QRCode value={payload} size={220} />
      </View>

      <Pressable style={[styles.btn, (!total || total <= 0) && { opacity: 0.6 }]} onPress={copiar} disabled={!total || total <= 0}>
        <Text style={styles.btnText}>Copiar código Pix</Text>
      </Pressable>

      <Text style={styles.tip}>
        O QR/código corresponde ao valor atual desta comanda.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  sub: { color: '#555', marginTop: 4 },
  valor: { fontSize: 22, fontWeight: 'bold', marginVertical: 8 },
  qrBox: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 12, backgroundColor: '#fff', marginVertical: 12 },
  btn: { backgroundColor: '#1976d2', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginTop: 6 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  tip: { color: '#666', textAlign: 'center', marginTop: 8 }
});
