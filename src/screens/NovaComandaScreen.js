import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { query, run, calcularTotalComanda } from '../db';
import AutocompleteInput from '../components/AutocompleteInput';
import { money } from '../utils/format';
import { emitComandaFechada } from '../utils/events';
import { nowSqlLocal } from '../utils/time';



export default function NovaComandaScreen({ route, navigation }) {
  const comandaIdParam = route?.params?.comandaId ?? null;
  const [comandaId, setComandaId] = useState(comandaIdParam);
  const [nome, setNome] = useState('');
  const [status, setStatus] = useState('aberta'); // 'aberta' | 'fechada'
  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]);
  const [qtd, setQtd] = useState('1');

  const isFechada = status === 'fechada';

  const carregarProdutos = () => {
    const prods = query("SELECT * FROM produtos ORDER BY lower(nome) ASC");
    setProdutos(prods);
  };

  const carregarComanda = (id) => {
    const c = query("SELECT * FROM comandas WHERE id=?", [id])?.[0];
    if (c) {
      setNome(c.nome);
      setStatus(c.status);
    }
  };

  const carregarItens = (id) => {
    const rows = query(`
      SELECT i.id, i.comanda_id, i.produto_id, i.descricao, i.quantidade, i.preco_unit,
             COALESCE(p.nome, i.descricao) as nomeProduto
      FROM itens i
      LEFT JOIN produtos p ON p.id = i.produto_id
      WHERE i.comanda_id = ?
      ORDER BY i.id DESC
    `, [id]);
    setItens(rows);
  };

  useEffect(() => {
    carregarProdutos();
    if (comandaId) {
      carregarComanda(comandaId);
      carregarItens(comandaId);
    }
  }, [comandaId]);

  const adicionarProduto = (produto) => {
    if (!comandaId) {
      Alert.alert('Selecione pela lista', 'Abra uma comanda na aba "Comandas".');
      return;
    }
    if (isFechada) {
      Alert.alert('Comanda fechada', 'Não é possível adicionar itens.');
      return;
    }
    const quantidade = Math.max(1, parseInt(qtd || '1', 10));
    run("INSERT INTO itens (comanda_id, produto_id, quantidade, preco_unit) VALUES (?, ?, ?, ?)", [
      comandaId, produto.id, quantidade, produto.preco
    ]);
    carregarItens(comandaId);
  };

  const adicionarItemLivre = () => {
    if (!comandaId) {
      Alert.alert('Selecione pela lista', 'Abra uma comanda na aba "Comandas".');
      return;
    }
    if (isFechada) {
      Alert.alert('Comanda fechada', 'Não é possível adicionar itens.');
      return;
    }
    // Alert.prompt só existe no iOS; no Android você pode criar outro fluxo se quiser
    Alert.prompt?.('Descrição do item', 'Digite a descrição e valor (ex: Bolo 12.50)', (text) => {
      if (!text) return;
      const parts = text.trim().split(' ');
      const valStr = parts.pop();
      const descricao = parts.join(' ');
      const preco = parseFloat(String(valStr).replace(',', '.'));
      const quantidade = Math.max(1, parseInt(qtd || '1', 10));
      if (!descricao || isNaN(preco)) {
        Alert.alert('Formato inválido', 'Use: Descrição Valor (ex: Bolo 12.50)');
        return;
      }
      run("INSERT INTO itens (comanda_id, descricao, quantidade, preco_unit) VALUES (?, ?, ?, ?)", [
        comandaId, descricao, quantidade, preco
      ]);
      carregarItens(comandaId);
    });
  };

  const salvarNome = () => {
    if (!comandaId) return;
    const n = nome.trim();
    if (!n) return;
    run("UPDATE comandas SET nome=? WHERE id=?", [n, comandaId]);
    Alert.alert('Salvo', 'Nome atualizado.');
  };

  const removerItem = (itemId) => {
    if (isFechada) {
      Alert.alert('Comanda fechada', 'Não é possível remover itens.');
      return;
    }
    run("DELETE FROM itens WHERE id=?", [itemId]);
    carregarItens(comandaId);
  };

const finalizarComanda = () => {
  if (!comandaId) return;
  const total = calcularTotalComanda(comandaId);

  Alert.alert(
    'Finalizar comanda',
    'Como deseja finalizar?',
    [
      {
        text: 'PIX (QR)',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [0, nowSqlLocal(), comandaId]);
          setStatus('fechada');
          emitComandaFechada({ comandaId, total });
          navigation.navigate('Pix', { comandaId }); // tela recalcula o total atual
        }
      },
      {
        text: 'Não pago',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [0, nowSqlLocal(), comandaId]);
          setStatus('fechada');
          emitComandaFechada({ comandaId, total });
          Alert.alert('Comanda fechada', `Total: ${money(total)} (Não paga)`);
          navigation.navigate('Comandas');
        }
      },
      {
        text: 'Pago',
        onPress: () => {
          run("UPDATE comandas SET status='fechada', pago=?, closed_at=? WHERE id=?", [1, nowSqlLocal(), comandaId]);
          setStatus('fechada');
          emitComandaFechada({ comandaId, total });
          Alert.alert('Comanda fechada', `Total: ${money(total)} (Paga)`);
          navigation.navigate('Comandas');
        }
      },
    ],
    { cancelable: true }
  );
};


  const total = useMemo(() => (comandaId ? calcularTotalComanda(comandaId) : 0), [itens, comandaId]);

  if (!comandaId) {
    return (
      <View style={{ flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, textAlign: 'center', color: '#555' }}>
          Selecione uma comanda na aba {"Comandas"} para editar.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
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

      <Text style={[styles.label, { marginTop: 12 }]}>Adicionar Produto</Text>
      <View pointerEvents={isFechada ? 'none' : 'auto'} style={isFechada && { opacity: 0.6 }}>
        <AutocompleteInput
          data={produtos}
          onSelect={adicionarProduto}
          placeholder="Digite para buscar..."
        />
      </View>

      <Pressable onPress={adicionarItemLivre} style={[styles.btnLivre, isFechada && styles.btnDisabled]}>
        <Text style={styles.btnText}>+ Item Livre (descrição + valor)</Text>
      </Pressable>

      <Text style={[styles.label, { marginTop: 12 }]}>Itens da Comanda</Text>
      <FlatList
        data={itens}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View>
              <Text style={{ fontWeight: 'bold' }}>{item.nomeProduto}</Text>
              <Text>Qtd: {item.quantidade} • Unit: {money(item.preco_unit)}</Text>
            </View>
            {!isFechada && (
              <Pressable onPress={() => removerItem(item.id)} style={styles.btnRem}>
                <Text style={styles.btnTextSmall}>Remover</Text>
              </Pressable>
            )}
          </View>
        )}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: 'bold', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: '#fff', color:'#111' },
  disabled: { backgroundColor: '#f1f1f1' },
  btnSalvar: { backgroundColor: '#0288d1', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnTextSmall: { color: '#fff', fontWeight: 'bold' },
  btnLivre: { backgroundColor: '#455a64', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, marginBottom: 8 },
  btnRem: { backgroundColor: '#c62828', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  footer: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalText: { fontSize: 18, fontWeight: 'bold' },
  btnFechar: { backgroundColor: '#2e7d32', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  btnFinalizada: { backgroundColor: '#9e9e9e', paddingVertical: 10, borderRadius: 8 }
});
