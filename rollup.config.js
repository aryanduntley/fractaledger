import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import { glob } from 'glob';

// Get all JS files in src and transceivers directories
const files = glob.sync('{src,transceivers}/**/*.js');

// Create an entry point for each file
const entries = files.reduce((acc, file) => {
  const name = file.replace(/\.js$/, '');
  acc[name] = file;
  return acc;
}, {});

export default {
  input: entries,
  output: {
    dir: 'dist/esm',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: '.'
  },
  external: [
    'express',
    'cors',
    'morgan',
    'jsonwebtoken',
    'winston',
    'bitcoinjs-lib',
    'fabric-ca-client',
    'fabric-common',
    'fabric-contract-api',
    'fabric-network',
    '@hyperledger/fabric-gateway',
    'joi',
    'path',
    'fs',
    'crypto',
    'events',
    'axios',
    'pkcs11js',
    'electrum-client',
    '@grpc/grpc-js',
    'protobufjs',
    '@protobufjs/inquire'
  ],
  plugins: [
    resolve(),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      tsconfigOverride: {
        compilerOptions: {
          module: 'esnext'
        }
      }
    })
  ]
};
