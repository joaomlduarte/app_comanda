import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { query, run, calcularTotalComanda } from '../db';
import AutocompleteInput from '../components/AutocompleteInput';
import { money } from '../utils/format';

export default function EditarFechadaScreen({ route, navigation }) {
  const comandaId = route?.params?.comandaId;
  const [nome, setNome] = useState('');
  const [closedAt, setClosedAt] = useState('');
  const [pago, setPago] = useState(null); // 1|0|null
  const [itens, setItens] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [qtd, setQtd] = useState('1');

  const total = useMemo(() => (comandaId ? calcularTotalComanda(comandaId) : 0), [itens, comandaId]);

  const carregarCabecalho = () => {
    const c = query("SELECT nome, status, closed_at, pago FROM comandas WHERE id=?", [comandaId])?.[0];
    if (!c) {
      Alert.alert('Erro', 'Comanda não encontrada.');
      navigation.goBack();
      return;
    }
    if (c.status !== 'fechada') {
      Alert.alert('Aviso', 'Esta tela edita apenas comandas fechadas.');
    }
    setNome(c.nome);
    setClosedAt(c.closed_at || '');
    setPago(c.pago);
  };

  const carregarItens = () => {
    const rows = query(`
      SELECT i.id, i.comanda_id, i.produto_id, i.descricao, i.quantidade, i.preco_unit,
             COALESCE(p.nome, i.descricao) as nomeProduto
      FROM itens i
      LEFT JOIN produtos p ON p.id = i.produto_id
      WHERE i.comanda_id = ?
      ORDER BY i.id DESC
    `, [comandaId]);
    setItens(rows);
  };

  const carregarProdutos = () => {
    const prods = query("SELECT * FROM produtos ORDER BY lower(nome) ASC");
    setProdutos(prods);
  };

  useEffect(() => {
    if (!comandaId) return;
    carregarCabecalho();
    carregarProdutos();
    carregarItens();
  }, [comandaId]);

  const addProduto = (produto) => {
    const q = Math.max(1, parseInt(qtd || '1', 10));
    run("INSERT INTO itens (comanda_id, produto_id, quantidade, preco_unit) VALUES (?,?,?,?)",
      [comandaId, produto.id, q, produto.preco]);
    carregarItens();
  };

  const inc = (itemId) => {
    const i = itens.find(x => x.id === itemId);
    if (!i) return;
    run("UPDATE itens SET quantidade=? WHERE id=?", [Number(i.quantidade) + 1, itemId]);
    carregarItens();
  };
  const dec = (itemId) => {
    const i = itens.find(x => x.id === itemId);
    if (!i) return;
    const nova = Math.max(1, Number(i.quantidade) - 1);
    run("UPDATE itens SET quantidade=? WHERE id=?", [nova, itemId]);
    carregarItens();
  };
  const removerItem = (itemId) => {
    run("DELETE FROM itens WHERE id=?", [itemId]);
    carregarItens();
  };

  const togglePago = () => {
    const novo = pago === 1 ? 0 : 1;
    run("UPDATE comandas SET pago=? WHERE id=?", [novo, comandaId]);
    setPago(novo);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>Editar Comanda (fechada)</Text>

      <View style={{ gap: 6, marginBottom: 8 }}>
        <Text style={styles.label}>Nome</Text>
        <TextInput value={nome} editable={false} style={[styles.input, styles.readonly]} />
        <Text style={styles.meta}>Fechada em: {closedAt || '—'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={styles.meta}>
            Situação: {pago === 1 ? 'Pago' : (pago === 0 ? 'Não pago' : '—')}
          </Text>
          <Pressable onPress={togglePago} style={[styles.btnSmall, { backgroundColor: '#6a1b9a' }]}>
            <Text style={styles.btnSmallText}>{pago === 1 ? 'Marcar não pago' : 'Marcar pago'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <Text style={styles.label}>Qtd</Text>
        <TextInput
          style={[styles.input, { width: 80 }]}
          keyboardType="numeric"
          value={qtd}
          onChangeText={setQtd}
          placeholder="Qtd"
        />
      </View>

      <Text style={[styles.label, { marginTop: 8 }]}>Adicionar Produto</Text>
      <AutocompleteInput
        data={produtos}
        onSelect={addProduto}
        placeholder="Digite para buscar..."
      />

      <Text style={[styles.label, { marginTop: 12 }]}>Itens</Text>
      <FlatList
        data={itens}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>{item.nomeProduto}</Text>
              <Text style={{ color: '#555' }}>Unit: {money(item.preco_unit)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable onPress={() => dec(item.id)} style={[styles.btnQty, { backgroundColor: '#455a64' }]}><Text style={styles.btnSmallText}>-</Text></Pressable>
              <Text style={{ minWidth: 22, textAlign: 'center' }}>{item.quantidade}</Text>
              <Pressable onPress={() => inc(item.id)} style={[styles.btnQty, { backgroundColor: '#1976d2' }]}><Text style={styles.btnSmallText}>+</Text></Pressable>
              <Pressable onPress={() => removerItem(item.id)} style={[styles.btnSmall, { backgroundColor: '#c62828' }]}><Text style={styles.btnSmallText}>Remover</Text></Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#777', marginTop: 12 }}>Sem itens.</Text>}
      />

      <View style={styles.footer}>
        <Text style={styles.totalText}>Total: {money(total)}</Text>
        <Text style={{ color: '#666' }}>Alterações preservam a data de fechamento.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  label: { fontWeight: 'bold' },
  meta: { color: '#666' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, backgroundColor: '#fff', color: '#111' },
  readonly: { backgroundColor: '#f6f6f6' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, marginBottom: 8 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
  btnQty: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnSmallText: { color: '#fff', fontWeight: 'bold' },
  footer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', marginTop: 8 },
  totalText: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
});
