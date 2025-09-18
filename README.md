
# Kitutes do Nardi (Expo)

App de comandas para Android (funciona em celular e tablet via Expo Go).

## Funcionalidades
- Cadastro de produtos (nome + preço) persistido em SQLite (local).
- Criação de comandas, adição de itens (com autocomplete dos produtos) e remoção de itens.
- Fechamento de comanda com cálculo de total.
- Lista de comandas em ordem alfabética.
- Dashboard com faturamento do dia (somente comandas fechadas).
- Exportação de resumo de vendas do dia para XLS (compartilha o arquivo).

## Como rodar

1. **Pré‑requisitos**: Node 18+, npm, Expo CLI (`npm i -g expo`), app **Expo Go** no Android.
2. Abra o projeto no VS Code e rode:
   ```bash
   npm install
   npm start
   ```
3. Leia o QR Code com o **Expo Go** no Android.

> Observação: Tudo foi feito para rodar **no Expo Go** (sem EAS nativo).

## Dependências principais
- `expo-sqlite`: banco local persistente.
- `@react-navigation/*`: navegação por abas.
- `xlsx` + `expo-file-system` + `expo-sharing`: exportar e compartilhar planilha XLSX.

## Estrutura
```
src/
  db.js               # criação das tabelas, helpers e consultas
  utils/format.js     # helpers de formatação
  components/AutocompleteInput.js
  screens/
    DashboardScreen.js
    ComandasListScreen.js
    NovaComandaScreen.js
    ProdutosScreen.js
    ExportarScreen.js
```

## Dicas
- Para manter itens na comanda mesmo após sair e voltar, tudo já está sendo salvo na tabela `itens`.
- A lista de comandas já ordena alfabeticamente por `nome`.
- O Dashboard pega o faturamento do dia `date('now')` do dispositivo; ajuste o fuso se precisar.
- Para exportar, informe a data no formato `YYYY-MM-DD` (ex.: `2025-09-18`). O arquivo é gerado e aberto no compartilhamento do Android.
