import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { query, run, calcularTotalComanda } from '../db';
import { money } from '../utils/format';
import { emitComandaFechada } from '../utils/events';
import { nowSqlLocal } from '../utils/time';
import { useWindowDimensions } from 'react-native';


export default function NovaComandaScreen({ route, navigation }) {
  const comandaIdParam = route?.params?.comandaId ?? null;
  const [comandaId, setComandaId] = useState(comandaIdParam);

  const [nome, setNome] = useState('');
  const [status, setStatus] = useState('aberta'); // 'aberta' | 'fechada'
  const isFechada = status === 'fechada';

  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]);

  // quantidade padrão (toque curto)
  const [qtd, setQtd] = useState('1');

  // card em “ajuste rápido” (−/+)
  const [quickId, setQuickId] = useState(null);

  const { width } = useWindowDimensions();
  // ajuste se seu padding lateral mudar (a tela usa padding:16)
  const PAD = 16;          // padding horizontal do container
  const GUTTER = 12;       // espaço horizontal/vertical entre cards
  // 3 colunas => 2 gutters no total: (col1) G (col2) G (col3)
  const cardWidth = Math.floor((width - PAD * 2 - GUTTER * 2) / 3);

  // total recalculado
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

  // inserir item (toque curto usa qtd padrão)
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
    // upsert simples: tenta pegar último item desse produto e soma a qty
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

  // ajuste rápido (−/+) no card
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

  const toggleQuick = (p) => {
    if (isFechada) return;
    setQuickId((prev) => (prev === p.id ? null : p.id));
  };

  const salvarNome = () => {
    if (!comandaId) return;
    const n = nome.trim();
    if (!n) return;
    run('UPDATE comandas SET nome=? WHERE id=?', [n, comandaId]);
    Alert.alert('Salvo', 'Nome atualizado.');
  };

  const removerItem = (itemId) => {
    if (isFechada) {
      Alert.alert('Comanda fechada', 'Não é possível remover itens.');
      return;
    }
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

    Alert.alert(
      'Finalizar comanda',
      'Como deseja finalizar?',
      [
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
      ],
      { cancelable: true }
    );
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

  // Cabeçalho rolável (nome + qtd + grade)
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

      {/* Qtd padrão para toque curto */}
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

      {/* Grade de produtos */}
      <Text style={[styles.label, { marginTop: 8 }]}>
        Produtos (toque = +{Math.max(1, parseInt(qtd || '1', 10))} • segure = ajustar)
      </Text>
      <View style={styles.grid}>
        {produtos.map((p) => {
          const isQuick = quickId === p.id;
          return (
            <Pressable
              key={p.id}
              style={[styles.prodCard, isFechada && { opacity: 0.6 }]}
              disabled={isFechada}
              onPress={() => addProdutoGrid(p, qtd)}     // toque curto = +Qtd
              onLongPress={() => toggleQuick(p)}         // long press = mostrar −/+
              delayLongPress={300}
            >
              <Text style={styles.prodTitle} numberOfLines={1}>{p.nome}</Text>
              <Text style={styles.prodPrice}>{money(p.preco)}</Text>

              {isQuick ? (
                <View style={styles.quickRow}>
                  <Pressable onPress={() => decProduto(p)} style={[styles.quickBtn, { backgroundColor: '#455a64' }]}>
                    <Text style={styles.quickText}>−</Text>
                  </Pressable>
                  <Pressable onPress={() => incProduto(p)} style={[styles.quickBtn, { backgroundColor: '#1976d2' }]}>
                    <Text style={styles.quickText}>+</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.prodHint}>toque para adicionar</Text>
              )}
            </Pressable>
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

  // grade de produtos (3 colunas)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    columnGap: 8,
    marginBottom: 8,
  },
  prodCard: {
    width: '32%', // 3 colunas
    minHeight: 86,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'center',
    marginBottom: 8,
  },
  prodTitle: { fontWeight: 'bold', color: '#111' },
  prodPrice: { color: '#1976d2', marginTop: 2 },
  prodHint: { color: '#777', fontSize: 12, marginTop: 2 },

  // ajuste rápido
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  quickBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  quickText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // lista de itens
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
