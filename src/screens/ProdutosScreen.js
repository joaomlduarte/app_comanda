import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { query, run } from '../db';

export default function ProdutosScreen() {
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [editId, setEditId] = useState(null);

  const carregar = () => {
    const rows = query("SELECT * FROM produtos ORDER BY lower(nome) ASC");
    setProdutos(rows);
  };

  useEffect(() => { carregar(); }, []);

  const limpar = () => {
    setNome('');
    setPreco('');
    setEditId(null);
  };

  const salvar = () => {
    const n = nome.trim();
    const p = parseFloat(preco.replace(',', '.'));
    if (!n || isNaN(p)) {
      Alert.alert('Atenção', 'Preencha nome e preço corretamente.');
      return;
    }
    try {
      if (editId) {
        run("UPDATE produtos SET nome=?, preco=? WHERE id=?", [n, p, editId]);
      } else {
        run("INSERT INTO produtos (nome, preco) VALUES (?, ?)", [n, p]);
      }
    } catch (e) {
      Alert.alert('Erro', 'Possivelmente já existe um produto com esse nome.');
      return;
    }
    limpar(); carregar();
  };

  const remover = (id) => {
    run("DELETE FROM produtos WHERE id=?", [id]);
    if (editId === id) limpar();
    carregar();
  };

  const editar = (item) => {
    setEditId(item.id);
    setNome(item.nome);
    setPreco(String(item.preco));
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>{editId ? 'Editar Produto' : 'Cadastro de Produtos'}</Text>
      <TextInput style={styles.input} placeholder="Nome" value={nome} onChangeText={setNome} placeholderTextColor="#9E9E9E" />
      <TextInput style={styles.input} placeholder="Preço (ex: 12.50)" value={preco} onChangeText={setPreco} keyboardType="decimal-pad" placeholderTextColor="#9E9E9E" />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={salvar} style={styles.btnSalvar}><Text style={styles.btnText}>{editId ? 'Atualizar' : 'Salvar'}</Text></Pressable>
        {editId && <Pressable onPress={limpar} style={styles.btnCancelar}><Text style={styles.btnText}>Cancelar</Text></Pressable>}
      </View>

      <FlatList
        style={{ marginTop: 16 }}
        data={produtos}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <View style={styles.prod}>
            <View>
              <Text style={{ fontWeight: 'bold' }}>{item.nome}</Text>
              <Text>R$ {Number(item.preco).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => editar(item)} style={styles.btnEditar}>
                <Text style={styles.btnTextSmall}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => remover(item.id)} style={styles.btnRem}>
                <Text style={styles.btnTextSmall}>Remover</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor:"#fff", color:"#111" },
  btnSalvar: { backgroundColor: '#1976d2', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnCancelar: { backgroundColor: '#757575', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  prod: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btnEditar: { backgroundColor: '#0288d1', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  btnRem: { backgroundColor: '#c62828', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  btnTextSmall: { color: '#fff', fontWeight: 'bold' }
});
