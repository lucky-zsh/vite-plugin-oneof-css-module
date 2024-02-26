import { readFileSync } from "fs-extra";
import { Plugin, PluginOption } from "vite";
import { compileCssModule, getCompile, getContentWithSourcemap, getModulesItem, getSassOptions, getUpdateList } from "./util";
import { dataToEsm } from '@rollup/pluginutils';
import path from "path";
import { AcceptedPlugin } from "postcss";
import { ModuleItem } from "./type";
const isModuleCss = (id: string) => /\.module\.scss/.test(id)
const isScss = (id: string) => /\.scss/.test(id)
let config: any = null;
let moduleJsonMap: Map<string, { moduleJsonCode: string; cssCode: string }> = new Map();

export interface VitePluginOneofCssModuleOptions {
    additionalData?: string,
    modules?: ModuleItem[],
    postcssPlugin?: AcceptedPlugin[]

}

const defaultOptions = {
    modules: [],
    postcssPlugin: [],
    additionalData: ''
}

const VitePluginOneofCssModule = function (options: VitePluginOneofCssModuleOptions): PluginOption {
    const { modules: moduleList, postcssPlugin, additionalData } = { ...defaultOptions, ...options }
    return {
        name: 'vite-plugin-oneof-css-module',
        enforce: "post",
        configResolved (resolvedConfig: any) {
            config = resolvedConfig
        },
        async load (id) {
            if (!isModuleCss(id) && isScss(id)) {
                const filePath = id.split("?")[0];
                const moduleOption = getModulesItem(moduleList, filePath)
                if (!moduleOption) {
                    return
                }

                const scssCode = readFileSync(filePath, 'utf-8');
                const sassOptions = await getSassOptions({
                    additionalData: additionalData
                }, scssCode, filePath)
                const compile = getCompile()

                const result = await compile(sassOptions);
                const { code: css, modules, map: cssMap, ast } = await compileCssModule(filePath, result.css, moduleOption, postcssPlugin);
                const modulesCode =
                    modules &&
                    dataToEsm(modules, {
                        namedExports: true,
                        preferConst: true,
                    });
                moduleJsonMap.set(filePath, { moduleJsonCode: modulesCode, cssCode: css });
                return {
                    code: css,
                    map: cssMap,
                    ast
                }
            }
        },
        handleHotUpdate ({ server, file, modules }) {
            if (!isModuleCss(file) && isScss(file)) {
                const updates = getUpdateList(modules);
                server.ws.send({
                    type: 'update',
                    updates,
                });
            }

        },
        async transform (_, id) {
            if (!isModuleCss(id) && isScss(id)) {
                const filePath = id.split("?")[0];
                const moduleObj = moduleJsonMap.get(filePath);
                if (!moduleObj) {
                    return;
                }
                const { moduleJsonCode, cssCode } = moduleObj;
                if (config.command === 'serve') {
                    let cssContent = cssCode
                    if (config.css.devSourcemap) {
                        const sourceMap = this.getCombinedSourcemap()
                        cssContent = await getContentWithSourcemap(cssCode, sourceMap, filePath, config)
                    }
                    const code = [
                        `import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from ${JSON.stringify(
                            path.posix.join(config.base, `/@vite/client`),
                        )}`,
                        `const __vite__id = ${JSON.stringify(id)}`,
                        `const __vite__css = ${JSON.stringify(cssContent)}`,
                        `__vite__updateStyle(__vite__id, __vite__css)`,
                        `${moduleJsonCode || 'import.meta.hot.accept()'}`,
                        `import.meta.hot.prune(() => __vite__removeStyle(__vite__id))`,
                    ].join('\n')
                    return { code, map: { mappings: '' } }
                } else {
                    return {
                        code: moduleJsonCode,
                        map: {
                            mappings: ''
                        },
                        moduleSideEffects: 'no-treeshake',
                    };
                }
            }
        }
    }
}

export default VitePluginOneofCssModule;
