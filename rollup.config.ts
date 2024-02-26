import type { RollupOptions } from 'rollup';
import { defineConfig } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import json from '@rollup/plugin-json';
import { resolve } from 'path';
import babel from '@rollup/plugin-babel';
import dts from 'rollup-plugin-dts';
import del from 'rollup-plugin-delete';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url)).toString()
);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default [
    defineConfig({
        input: './src/index.ts',
        treeshake: {
            moduleSideEffects: 'no-external',
            propertyReadSideEffects: false,
            tryCatchDeoptimization: false
        },
        output: [
            {
                format: 'cjs',
                strict: false,
                file: pkg.main,
                sourcemap: true,
                exports: 'named'
            },
            {
                file: pkg.module,
                sourcemap: true,
                exports: 'auto',
                format: 'esm'
            }
        ],
        external: ["vite"],
        plugins: [
            alias({
                entries: [
                    { find: '@', replacement: resolve(__dirname, './src') }
                ]
            }),
            babel({
                babelrc: false,
                include: ['./src/**/*.ts'],
                extensions: [".js", ".ts"],
                babelHelpers: "bundled",
                exclude: "node_modules/**",
                presets: [['@babel/preset-env'], "@babel/preset-typescript"]

            }),
            commonjs({
                transformMixedEsModules: true,
                include: [/node_modules/]
            }),
            nodeResolve({
                exportConditions: ['import', 'default', 'require', 'node'],
                preferBuiltins: true
            }),

            typescript({
                tsconfig: './tsconfig.json'
            }),

            json(),

        ],
        onwarn: (warning, warn) => {
            if (warning.message.includes('Circular dependency')) {
                return;
            }
            warn(warning);
        }
    }),
    defineConfig({
        input: './dist/types/src/index.d.ts',
        output: [{ file: resolve(__dirname, 'dist/index.d.ts'), format: 'es' }],
        plugins: [
            (dts as any).default(),
            process.env.NODE_ENV === 'production'
                ? del({ hook: 'buildEnd', targets: './dist/types' })
                : []
        ]
    })
] as RollupOptions[];
