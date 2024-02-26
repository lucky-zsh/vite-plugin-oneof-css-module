import { PluginOption, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import VitePluginOneofCssModule from "vite-plugin-oneof-css-module"
import postcssPresetEnv from "postcss-preset-env"

// https://vitejs.dev/config/
export default defineConfig({
    css: {
        devSourcemap: true
    },
    plugins: [
        react(),
        VitePluginOneofCssModule({
            modules: [
                {
                    test: /App\.scss$/,
                    generateScopedName: function (name) {

                        return `k_${name}`

                    },

                }
            ],
            postcssPlugin: [
                postcssPresetEnv()
            ]
        }) as PluginOption
    ],
    build: {
        sourcemap: true
    }
})
