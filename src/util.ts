import { createRequire } from "module"
import postcss, { AcceptedPlugin } from "postcss";
import postcssModules from 'postcss-modules';
import { ModuleNode, Update, formatPostcssSourceMap } from 'vite';
import url from "url";
import path from "path";
import { readFile, realpath } from "fs-extra";
import { ExistingRawSourceMap, SourceMap } from "rollup";
import { ModuleItem } from "./type";
const require = createRequire(import.meta.url)
export const getSassOptions = async (options: any, content: string, resourcePath: string) => {
    const sassOptions = {
        ...options,
        data: options.additionalData
            ? typeof options.additionalData === "function"
                ? await options.additionalData(content)
                : `${options.additionalData}\n${content}`
            : content,
        url: url.pathToFileURL(resourcePath),
        style: "compressed",
        sourceMap: false,
        outputStyle: "compressed"
    };
    if (typeof sassOptions.syntax === "undefined") {
        const ext = path.extname(resourcePath);
        if (ext && ext.toLowerCase() === ".scss") {
            sassOptions.syntax = "scss";
        } else if (ext && ext.toLowerCase() === ".sass") {
            sassOptions.syntax = "indented";
        } else if (ext && ext.toLowerCase() === ".css") {
            sassOptions.syntax = "css";
        }
    }
    return sassOptions;
}
const getDefaultSassImplementation = () => {
    let sassImplPkg = "sass";
    try {
        require.resolve("sass");
    } catch (ignoreError) {
        try {
            require.resolve("sass-embedded");
            sassImplPkg = "sass-embedded";
        } catch (__ignoreError) {
            sassImplPkg = "sass";
        }
    }
    return require(sassImplPkg);
}



export const getCompile = () => {
    const implementation = getDefaultSassImplementation();
    return (sassOptions: any) => {
        const { data, ...rest } = sassOptions;
        return implementation.compileStringAsync(data, rest);
    };
}




export const compileCssModule = async (
    id: string,
    code: string,
    moduleOption?: Record<string, any>,
    plugins?: AcceptedPlugin[],
): Promise<any> => {
    let modules;
    let postcssPlugins = [...(plugins ? plugins : [])];
    postcssPlugins.unshift(
        postcssModules({
            ...(moduleOption ? moduleOption : {}),
            getJSON (cssFileName: string, _modules: Record<string, any>, outputFileName: string) {
                modules = _modules;
                if (moduleOption && typeof moduleOption.getJSON === 'function') {
                    moduleOption.getJSON(cssFileName, _modules, outputFileName);
                }
            },
        })
    );
    const postcssResult = await postcss(postcssPlugins).process(code, {
        from: id,
        to: id,
        map: true
            ? {
                prev: false,
                inline: false,
                annotation: false,
                sourcesContent: true
            }
            : false,
    });
    const rawPostcssMap = postcssResult.map.toJSON()
    const postcssMap = await formatPostcssSourceMap(
        rawPostcssMap as unknown as ExistingRawSourceMap,
        cleanUrl(id)
    )
    return {
        ast: postcssResult,
        modules: modules ? modules : {},
        code: postcssResult.css,
        messages: postcssResult.messages,
        map: postcssMap
    };
};
export const getUpdateList = (modules: Set<ModuleNode> | ModuleNode[]) => {
    const jsFileReg = /(.jsx?|.tsx?)$/;
    const updates: Update[] = [];
    const loopFn = (modules: Set<ModuleNode> | ModuleNode[]) => {
        modules &&
            modules.forEach((module: ModuleNode) => {
                const fileUrl = module.url;
                if (jsFileReg.test(fileUrl)) {
                    updates.push({
                        type: `js-update`,
                        timestamp: new Date().getTime(),
                        path: fileUrl,
                        acceptedPath: fileUrl,
                    });
                    return;
                }
                module.importers &&
                    module.importers.forEach((ModuleNode: ModuleNode) => {
                        const fileUrl = ModuleNode.url;
                        if (jsFileReg.test(fileUrl)) {
                            updates.push({
                                type: `js-update`,
                                timestamp: new Date().getTime(),
                                path: ModuleNode.url,
                                acceptedPath: ModuleNode.url,
                            });
                        } else {
                            loopFn(ModuleNode.importers);
                        }
                    });
            });
    };
    loopFn(modules);
    return updates;
};
const virtualSourceRE = /^(?:dep:|browser-external:|virtual:)|\0/

export async function injectSourcesContent (
    map: any,
    file: string,
): Promise<void> {
    let sourceRoot: string | undefined
    try {
        sourceRoot = await realpath(
            path.resolve(path.dirname(file), map.sourceRoot || ''),
        )
    } catch { }

    const missingSources: string[] = []
    const sourcesContent = map.sourcesContent || []
    await Promise.all(
        map.sources.map(async (sourcePath: string, index: string | number) => {
            let content = null
            if (sourcePath && !virtualSourceRE.test(sourcePath)) {
                sourcePath = decodeURI(sourcePath)
                if (sourceRoot) {
                    sourcePath = path.resolve(sourceRoot, sourcePath)
                }
                // inject content from source file when sourcesContent is null
                content =
                    sourcesContent[index] ??
                    (await readFile(sourcePath, 'utf-8').catch(() => {
                        missingSources.push(sourcePath)
                        return null
                    }))
            }
            sourcesContent[index] = content
        }),
    )

    map.sourcesContent = sourcesContent
    if (missingSources.length) {
        console.error(`Sourcemap for "${file}" points to missing source files`)
    }
}
const postfixRE = /[?#].*$/s
export function cleanUrl (url: string): string {
    return url.replace(postfixRE, '')
}
export function genSourceMapUrl (map: SourceMap | string): string {
    if (typeof map !== 'string') {
        map = JSON.stringify(map)
    }
    return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
}
export function getCodeWithSourcemap (
    type: 'js' | 'css',
    code: string,
    map: any,
): string {


    if (type === 'js') {
        code += `\n//# sourceMappingURL=${genSourceMapUrl(map)}`
    } else if (type === 'css') {
        code += `\n/*# sourceMappingURL=${genSourceMapUrl(map)} */`
    }

    return code
}


export const getContentWithSourcemap = async (content: string, sourcemap: SourceMap, id: string, config: any,) => {
    if (config.css?.devSourcemap) {
        if (sourcemap.mappings) {
            await injectSourcesContent(sourcemap, cleanUrl(id))
        }
        return getCodeWithSourcemap('css', content, sourcemap)
    }
    return content
}


export const getModulesItem = (modules: ModuleItem[], filePath: string) => {
    if (Array.isArray(modules) && modules.length) {
        const item = modules.find((el) => el.test.test(filePath));
        return item;
    }
    return
}
