// src/shims/index.js
// Polyfills mínimos para o 'xlsx' rodar no React Native / Expo
import { encode, decode } from 'base-64';
import { Buffer } from 'buffer';

if (!global.btoa) global.btoa = encode;
if (!global.atob) global.atob = decode;
if (!global.Buffer) global.Buffer = Buffer;

// Alguns builds procuram por 'Base64'
if (!global.Base64) global.Base64 = { encode, decode };
