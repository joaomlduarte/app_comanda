# Kitutes do Nardi — App de Comandas (Expo SDK 54)

Aplicativo mobile (Android e iOS) para controle de **comandas** com banco local (**SQLite**), finalização com **Pix (QR)**, exportação **XLSX**, **dashboard** de faturamento diário, **histórico** com edição de comandas fechadas e **catálogo de produtos**. O app utiliza **tema claro fixo** e navegação por abas com ícones.

> **Observação:** a versão Web não é suportada (SQLite nativo). Rode no Android/iOS.

---

## ✨ Funcionalidades
- **Comandas**
  - Criar comanda e renomear.
  - Adicionar itens do **catálogo local** (nome + preço).
  - **Grade de produtos**: toque = `+1`; **pressione e segure** = escolher quantidade (+/−).
  - **Finalizar**: _Pago_, _Não pago_ ou _Pix (QR)_.
  - Fechamento grava `closed_at` e **atualiza o dashboard** em tempo real.
- **Produtos**
  - Cadastro de produtos (nome + preço) persistidos no SQLite.
- **Dashboard**
  - Faturamento do dia com **seletor de data**.
- **Exportar**
  - Gera **XLSX** do dia com colunas: `Comanda | Situação | Item | Qtd | Unitário | Subtotal`.
  - Situação mostra **“pago (pix)”** quando `metodo_pagto = 'pix'`.
- **Histórico**
  - Filtro **dia/todas** e busca por **nome**.
  - **Editar comanda fechada** (sem reabrir).
  - **Marcar pago** (metodo_pagto = `manual`) ou desmarcar (metodo_pagto = `NULL`).
  - **Mostrar QR Pix** novamente.
  - **Excluir** comanda (remove itens e comanda).
- **UI**
  - **Tema claro fixo** (independente do tema do SO).
  - Abas com **ícones** (MaterialCommunityIcons).

---

## 🧱 Arquitetura / Tecnologias
- **Expo SDK 54** (React Native)
- Navegação: **React Navigation** (Bottom Tabs + Native Stack)
- Banco local: **expo-sqlite**
- XLSX: **xlsx** + **expo-file-system/legacy** + **expo-sharing**
- Pix: geração de **payload BR Code estático** com **valor** e renderização de **QR**
- Date/time: **@react-native-community/datetimepicker**

---

## 📁 Estrutura (essencial)
