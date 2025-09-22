import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { query, run, calcularTotalComanda } from '../db';
import { money } from '../utils/format';
import { emitComandaFechada } from '../utils/events';
import { nowSqlLocal } from '../utils/time';

export default function NovaComandaScreen({ route, navigation }) {
  const comandaId = route?.params?.comandaId ?? null;

  const [nome, setNome] = useState('');
  const [status, setStatus] = useState('aberta'); // 'aberta' | 'fechada'
  const isFechada = status === 'fechada';

  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]);

  // quantidade padrão (toque curto)
  const [qtd, setQtd] = useState('1');

  // card em “ajuste rápido” (−/+)
  const [quickId, setQuickId] = useState(null);

  const total = useMemo(() => (comandaId ? calcularTotalComanda(comandaId) : 0), [itens, comandaId]);

  const carregarProdutos = () => {
    const prods = query('SELECT * FROM produtos ORDER BY lower(nome) ASC');
    setProdutos(prods);
  };

  const carregarComanda = (id) => {
    const c = query('SELECT * FROM comandas WHERE id=?', [id])?.[0];
    if (c) {
      setNome(c.nome);
      setStatus(c.status);
    }
  };

  const carregarItens = (id) => {
    const rows = query(
      `
      SELECT i.id, i.comanda_id, i.produto_id, i.descricao, i.quantidade, i.preco_unit,
             COALESCE(p.nome, i.descricao) as nomeProduto
      FROM itens i
      LEFT JOIN produtos p ON p.id = i.produto_id
      WHERE i.comanda_id = ?
      ORDER BY i.id DESC
    `,
      [id]
    );
    setItens(rows);
  };

  useEffect(() => {
    carregarProdutos();
  }, []);

  useEffect(() => {
    if (comandaId) {
      carregarComanda(comandaId);
      carregarItens(comandaId);
    }
  }, [comandaId]);

  // inserir item (toque curto usa qtd padrão; faz “upsert” simples)
  const addProdutoGrid = (produto, qOverride) => {
    if (!comandaId) {
      Alert.alert('Selecione pela lista', 'Abra uma comanda na aba "Comandas".');
      return;
    }
    if (isFechada) {
      Alert.alert('Comanda fechada', 'Não é possível adicionar itens.');
      return;
    }
    const q = Math.max(1, parseInt(qOverride ?? qtd ?? '1', 10));
    const exist = query(
      'SELECT id, quantidade FROM itens WHERE comanda_id=? AND produto_id=? ORDER BY id DESC LIMIT 1',
      [comandaId, produto.id]
    )?.[0];
    if (exist) {
      run('UPDATE itens SET quantidade=? WHERE id=?', [Number(exist.quantidade) + q, exist.id]);
    } else {
      run('INSERT INTO itens (comanda_id, produto_id, quantidade, preco_unit) VALUES (?,?,?,?)', [
        comandaId,
        produto.id,
        q,
        produto.preco,
      ]);
    }
    carregarItens(comandaId);
  };

  const incProduto = (p) => {
    if (isFechada || !comandaId) return;
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
    carregarItens(comandaId);
  };
  const decProduto = (p) => {
    if (isFechada || !comandaId) return;
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
    carregarItens(comandaId);
  };

  const toggleQuick = (p) => setQuickId((prev) => (prev === p.id ? null : p.id));

  const salvarNome = () => {
    if (!comandaId) return;
    const n = nome.trim();
    if (!n) return;
    run('UPDATE comandas SET nome=? WHERE id=?', [n, comandaId]);
    Alert.alert('Salvo', 'Nome atualizado.');
  };

  const removerItem = (itemId) => {
    if (isFechada) return;
    run('DELETE FROM itens WHERE id=?', [itemId]);
    carregarItens(comandaId);
  };
  const inc = (itemId) => {
    if (isFechada) return;
    const i = itens.find((x) => x.id === itemId);
    if (!i) return;
    run('UPDATE itens SET quantidade=? WHERE id=?', [Number(i.quantidade) + 1, itemId]);
    carregarItens(comandaId);
  };
  const dec = (itemId) => {
    if (isFechada) return;
    const i = itens.find((x) => x.id === itemId);
    if (!i) return;
    const nova = Math.max(1, Number(i.quantidade) - 1);
    run('UPDATE itens SET quantidade=? WHERE id=?', [nova, itemId]);
    carregarItens(comandaId);
  };

  const finalizarComanda = () => {
    if (!comandaId) return;
    const tot = calcularTotalComanda(comandaId);

    Alert.alert('Finalizar comanda', 'Como deseja finalizar?', [
      {
        text: 'PIX (QR)',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [0, nowSqlLocal(), comandaId]);
          setStatus('fechada');
          emitComandaFechada({ comandaId, total: tot });
          navigation.navigate('Pix', { comandaId });
        },
      },
      {
        text: 'Não pago',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [0, nowSqlLocal(), comandaId]);
          setStatus('fechada');
          emitComandaFechada({ comandaId, total: tot });
          Alert.alert('Comanda fechada', `Total: ${money(tot)} (Não paga)`);
          navigation.navigate('Comandas');
        },
      },
      {
        text: 'Pago',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [1, nowSqlLocal(), comandaId]);
          setStatus('fechada');
          emitComandaFechada({ comandaId, total: tot });
          Alert.alert('Comanda fechada', `Total: ${money(tot)} (Paga)`);
          navigation.navigate('Comandas');
        },
      },
    ]);
  };

  if (!comandaId) {
    return (
      <View style={{ flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, textAlign: 'center', color: '#555' }}>
          Selecione uma comanda na aba "Comandas" para editar.
        </Text>
      </View>
    );
  }

  // Cabeçalho: nome + qtd + grade (3 colunas cheias)
  const GUTTER = 12;
  const Header = (
    <View>
      <Text style={styles.label}>Nome da Comanda</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          style={[styles.input, { flex: 1 }, isFechada && styles.disabled]}
          placeholder="Ex: Maria, Mesa 3..."
          editable={!isFechada}
          value={nome}
          onChangeText={setNome}
        />
        {!isFechada && (
          <Pressable style={styles.btnSalvar} onPress={salvarNome}>
            <Text style={styles.btnTextSmall}>Salvar</Text>
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={styles.label}>Qtd</Text>
        <TextInput
          style={[styles.input, { width: 80 }, isFechada && styles.disabled]}
          keyboardType="numeric"
          editable={!isFechada}
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
                style={[styles.card, isFechada && styles.cardDisabled]}
                disabled={isFechada}
                onPress={() => addProdutoGrid(p, qtd)}
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

      <Text style={[styles.label, { marginTop: 12 }]}>Itens da Comanda</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={itens}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontWeight: 'bold' }}>{item.nomeProduto || item.descricao}</Text>
              <Text style={{ color: '#555' }}>Unit: {money(item.preco_unit)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable
                onPress={() => (isFechada ? null : dec(item.id))}
                style={[styles.btnQty, { backgroundColor: '#455a64' }, isFechada && { opacity: 0.4 }]}
                disabled={isFechada}
              >
                <Text style={styles.btnSmallText}>-</Text>
              </Pressable>
              <Text style={{ minWidth: 22, textAlign: 'center' }}>{item.quantidade}</Text>
              <Pressable
                onPress={() => (isFechada ? null : inc(item.id))}
                style={[styles.btnQty, { backgroundColor: '#1976d2' }, isFechada && { opacity: 0.4 }]}
                disabled={isFechada}
              >
                <Text style={styles.btnSmallText}>+</Text>
              </Pressable>
              <Pressable
                onPress={() => (isFechada ? null : removerItem(item.id))}
                style={[styles.btnSmall, { backgroundColor: '#c62828' }, isFechada && { opacity: 0.4 }]}
                disabled={isFechada}
              >
                <Text style={styles.btnSmallText}>Remover</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#777', marginTop: 12 }}>Sem itens.</Text>}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.totalText}>Total: {money(total)}</Text>
            {isFechada ? (
              <View style={[styles.btnFinalizada, { paddingHorizontal: 12 }]}>
                <Text style={styles.btnText}>Fechada</Text>
              </View>
            ) : (
              <Pressable onPress={finalizarComanda} style={styles.btnFechar}>
                <Text style={styles.btnText}>Finalizar</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: 'bold', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: '#fff', color: '#111' },
  disabled: { backgroundColor: '#f1f1f1' },

  btnSalvar: { backgroundColor: '#0288d1', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnTextSmall: { color: '#fff', fontWeight: 'bold' },

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
  cardDisabled: { opacity: 0.6 },
  cardTitle: { fontWeight: 'bold', color: '#111', fontSize: 15, minHeight: 20 },
  cardPrice: { color: '#1976d2', marginTop: 6, fontSize: 14 },
  cardHint: { color: '#777', fontSize: 12, marginTop: 4 },

  quickRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  quickBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 10 },
  btnMinus: { backgroundColor: '#455a64' },
  btnPlus: { backgroundColor: '#1976d2' },
  quickTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  btnQty: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  btnSmallText: { color: '#fff', fontWeight: 'bold' },

  footer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalText: { fontSize: 18, fontWeight: 'bold' },
  btnFechar: { backgroundColor: '#2e7d32', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  btnFinalizada: { backgroundColor: '#9e9e9e', paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
