
import React, { useState, useMemo } from 'react';
import { View, TextInput, FlatList, Text, Pressable, StyleSheet } from 'react-native';

export default function AutocompleteInput({ data = [], onSelect, placeholder='Buscar produto...' }) {
  const [text, setText] = useState('');

  const suggestions = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return [];
    return data.filter(p => p.nome.toLowerCase().includes(t));
  }, [text, data]);

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={text}
        onChangeText={setText}
        autoCorrect={false}
      />
      {suggestions.length > 0 && (
        <FlatList
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          data={suggestions}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable onPress={() => { onSelect(item); setText(''); }} style={styles.item}>
              <Text>{item.nome}</Text>
              <Text>R$ {Number(item.preco).toFixed(2)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 8 },
  list: { maxHeight: 180, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
  item: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
});
