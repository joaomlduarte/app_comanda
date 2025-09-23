import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { query, run, calcularTotalComanda } from '../db';
import { money } from '../utils/format';

export default function EditarFechadaScreen({ route, navigation }) {
  const comandaId = route?.params?.comandaId;

  const [nome, setNome] = useState('');
  const [closedAt, setClosedAt] = useState('');
  const [pago, setPago] = useState(null); // 1|0|null

  const [itens, setItens] = useState([]);
  const [produtos, setProdutos] = useState([]);

  const [qtd, setQtd] = useState('1');     // toque curto na grade
  const [quickId, setQuickId] = useState(null); // ajuste rápido na grade

  const total = useMemo(() => (comandaId ? calcularTotalComanda(comandaId) : 0), [itens, comandaId]);

  const carregarCabecalho = () => {
    const c = query('SELECT nome, status, closed_at, pago FROM comandas WHERE id=?', [comandaId])?.[0];
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
    const rows = query(
      `
      SELECT i.id, i.comanda_id, i.produto_id, i.descricao, i.quantidade, i.preco_unit,
             COALESCE(p.nome, i.descricao) as nomeProduto
      FROM itens i
      LEFT JOIN produtos p ON p.id = i.produto_id
      WHERE i.comanda_id = ?
      ORDER BY i.id DESC
    `,
      [comandaId]
    );
    setItens(rows);
  };

  const carregarProdutos = () => {
    const prods = query('SELECT * FROM produtos ORDER BY lower(nome) ASC');
    setProdutos(prods);
  };

  useEffect(() => {
    if (!comandaId) return;
    carregarCabecalho();
    carregarProdutos();
    carregarItens();
  }, [comandaId]);

  // inserir item (toque curto usa qtd)
  const addProduto = (produto, qOverride) => {
    const q = Math.max(1, parseInt(qOverride ?? qtd ?? '1', 10));
    run('INSERT INTO itens (comanda_id, produto_id, quantidade, preco_unit) VALUES (?,?,?,?)', [
      comandaId,
      produto.id,
      q,
      produto.preco,
    ]);
    carregarItens();
  };

  // ajuste rápido (−/+)
  const incProduto = (p) => {
    const exist = query(
      'SELECT id, quantidade FROM itens WHERE comanda_id=? AND produto_id=? ORDER BY id DESC LIMIT 1',
      [comandaId, p.id]
    )?.[0];
    if (exist) {
      run('UPDATE itens SET quantidade=? WHERE id=?', [Number(exist.quantidade) + 1, exist.id]);
    } else {
      run('INSERT INTO itens (comanda_id, produto_id, quantidade, preco_unit) VALUES (?,?,?,?)', [
        comandaId,
        p.id,
        1,
        p.preco,
      ]);
    }
    carregarItens();
  };
  const decProduto = (p) => {
    const exist = query(
      'SELECT id, quantidade FROM itens WHERE comanda_id=? AND produto_id=? ORDER BY id DESC LIMIT 1',
      [comandaId, p.id]
    )?.[0];
    if (!exist) return;
    const nova = Number(exist.quantidade) - 1;
    if (nova > 0) {
      run('UPDATE itens SET quantidade=? WHERE id=?', [nova, exist.id]);
    } else {
      run('DELETE FROM itens WHERE id=?', [exist.id]);
    }
    carregarItens();
  };

  const toggleQuick = (p) => setQuickId((prev) => (prev === p.id ? null : p.id));

  // edição na lista
  const inc = (itemId) => {
    const i = itens.find((x) => x.id === itemId);
    if (!i) return;
    run('UPDATE itens SET quantidade=? WHERE id=?', [Number(i.quantidade) + 1, itemId]);
    carregarItens();
  };
  const dec = (itemId) => {
    const i = itens.find((x) => x.id === itemId);
    if (!i) return;
    const nova = Math.max(1, Number(i.quantidade) - 1);
    run('UPDATE itens SET quantidade=? WHERE id=?', [nova, itemId]);
    carregarItens();
  };
  const removerItem = (itemId) => {
    run('DELETE FROM itens WHERE id=?', [itemId]);
    carregarItens();
  };

  const togglePago = () => {
    const novo = pago === 1 ? 0 : 1;
    run('UPDATE comandas SET pago=? WHERE id=?', [novo, comandaId]);
    setPago(novo);
  };

  // Cabeçalho (info + qtd + grade 3 colunas)
  const GUTTER = 12;
  const Header = (
    <View>
      <Text style={styles.title}>Editar Comanda (fechada)</Text>

      <View style={{ gap: 6, marginBottom: 8 }}>
        <Text style={styles.label}>Nome</Text>
        <TextInput value={nome} editable={false} style={[styles.input, styles.readonly]} />
        <Text style={styles.meta}>Fechada em: {closedAt || '—'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={styles.meta}>
            Situação: {pago === 1 ? 'Pago' : pago === 0 ? 'Não pago' : '—'}
          </Text>
          <Pressable onPress={togglePago} style={[styles.btnSmall, { backgroundColor: '#6a1b9a' }]}>
            <Text style={styles.btnSmallText}>{pago === 1 ? 'Marcar não pago' : 'Marcar pago'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <Text style={styles.label}>Qtd</Text>
        <TextInput
          style={[styles.input, { width: 80 }]}
          keyboardType="numeric"
          value={qtd}
          onChangeText={setQtd}
          placeholder="Qtd"
        />
      </View>

      <Text style={[styles.label, { marginTop: 8 }]}>
        Produtos (toque = +{Math.max(1, parseInt(qtd || '1', 10))} • segure = ajustar)
      </Text>

      <View style={[styles.grid, { marginHorizontal: -GUTTER / 2 }]}>
        {produtos.map((p) => {
          const isQuick = quickId === p.id;
          return (
            <View
              key={p.id}
              style={{ width: '33.3333%', paddingHorizontal: GUTTER / 2, marginBottom: GUTTER }}
            >
              <Pressable
                style={styles.card}
                onPress={() => addProduto(p, qtd)}
                onLongPress={() => toggleQuick(p)}
                delayLongPress={250}
              >
                <Text style={styles.cardTitle} numberOfLines={2}>{p.nome}</Text>
                <Text style={styles.cardPrice}>{money(p.preco)}</Text>

                {isQuick ? (
                  <View style={styles.quickRow}>
                    <Pressable onPress={() => decProduto(p)} style={[styles.quickBtn, styles.btnMinus]}>
                      <Text style={styles.quickTxt}>−</Text>
                    </Pressable>
                    <Pressable onPress={() => incProduto(p)} style={[styles.quickBtn, styles.btnPlus]}>
                      <Text style={styles.quickTxt}>+</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.cardHint}>toque para adicionar</Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={[styles.label, { marginTop: 12 }]}>Itens</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={itens}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold' }}>{item.nomeProduto}</Text>
              <Text style={{ color: '#555' }}>Unit: {money(item.preco_unit)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable onPress={() => dec(item.id)} style={[styles.btnQty, { backgroundColor: '#455a64' }]}>
                <Text style={styles.btnSmallText}>-</Text>
              </Pressable>
              <Text style={{ minWidth: 22, textAlign: 'center' }}>{item.quantidade}</Text>
              <Pressable onPress={() => inc(item.id)} style={[styles.btnQty, { backgroundColor: '#1976d2' }]}>
                <Text style={styles.btnSmallText}>+</Text>
              </Pressable>
              <Pressable onPress={() => removerItem(item.id)} style={[styles.btnSmall, { backgroundColor: '#c62828' }]}>
                <Text style={styles.btnSmallText}>Remover</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#777', marginTop: 12 }}>Sem itens.</Text>}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.totalText}>Total: {money(total)}</Text>
            <Text style={{ color: '#666' }}>Alterações preservam a data de fechamento.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  label: { fontWeight: 'bold' },
  meta: { color: '#666' },

  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, backgroundColor: '#fff', color: '#111' },
  readonly: { backgroundColor: '#f6f6f6' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    justifyContent: 'center',
  },
  cardTitle: { fontWeight: 'bold', color: '#111', fontSize: 15, minHeight: 20 },
  cardPrice: { color: '#1976d2', marginTop: 6, fontSize: 14 },
  cardHint: { color: '#777', fontSize: 12, marginTop: 4 },

  quickRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  quickBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 10 },
  btnMinus: { backgroundColor: '#455a64' },
  btnPlus: { backgroundColor: '#1976d2' },
  quickTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
  btnQty: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnSmallText: { color: '#fff', fontWeight: 'bold' },

  footer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', marginTop: 8 },
  totalText: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
});
