无论是微服务还是大型的项目，样式多了就容易被覆盖，目前css-in-js，scoped等都可以来实现，当然我比较喜欢使用CSS-Module，主要可以自由的定制class名称，也可以很好的去做区分，Vite其实也提供了CssModule，也可以根据不同的文件来自定义名称，但抛弃不掉的是.module.scss, 下面就说一下类似webpack中oneOf功能的Vite CssModule 插件,可以针对不同的正则来使用不同的CSS Module规则。

这个使用了postcss-modules,不清楚的可以进去看看github.com/madyankin/p…

## 安装

当然也可以使用yarn cnpm ，npm 都可以安装
js复制代码pnpm add -D vite-plugin-oneof-css-module

## 使用

在vite配置文件中,如下进行配置

```
import { defineConfig } from 'vite';
import VitePluginOneofCssModule from 'vite-plugin-oneof-css-module';
export default defineConfig({
    plugins: [
        VitePluginOneofCssModule({
            modules: [
                {
                    test: /\.scss$/,
                    generateScopedName: 'k-[local]'
                }
            ]
        })
    ]
});
```

### 功能一

比如我想在项目中使用index.scss 文件
index.scss 文件中

```
.box{
width:100px;
height:200px;
border:1px solid red;

}

```

index.tsx 文件中

```
import $style from "./index.scss"

<div className={$style.box}></div>
```

转换后的结果就是

```
.k-box{
    width:100px;
    height:200px;
    border:1px solid red;
    }
```

### 功能二

开启devsourcemap则转换后的class可以定位到具体的,默认false，如果在开发环境开启devsourcemap:true则转换后的class可以定位到具体的css位置，如果设置成false，则在style标签

```js

export default defineConfig({
    css:{
        devSourcemap:true
    }
    plugins: [
        VitePluginOneofCssModule({
            modules: [
                {
                    test: /\.scss$/,
                    generateScopedName: "k-[local]"
                }
            ]
        })
    ]
});
```

### 功能三

可以针对不同的文件进行处理，比如说按如下配置

```js
export default defineConfig({
    plugins: [
        VitePluginOneofCssModule({
            modules: [
                {
                    test: /index\.scss$/,
                    generateScopedName: 'k-[local]'
                },
                {
                    test: /app\.scss$/,
                    generateScopedName: 'v-[local]'
                }
            ]
        })
    ]
});
```

app.scss文件

```
.body{
    color:green;
}
```

app.tsx 文件

```js
import $style from './app.scss';

<div className={$style.body}>我是另一个scss文件</div>;
```

转换后结果为：
app.scss

```
.v-body{
    color:green;
}
```

index.scss

```
.k-box{
    width:100px;
    height:200px;
    border:1px solid red;
}
```

### 功能四

可以使用additionalData 全局注入scss 变量，比如如下

```js
export default defineConfig({
      plugins: [
        VitePluginOneofCssModule({
            additionalData 全局注入: "$color:red;",
            modules: [
                {
                    test: /index\.scss$/,
                    generateScopedName: "k-[local]"
                },
                {
                    test: /app\.scss$/,
                    generateScopedName: "v-[local]"
                }
            ]
        })
      ]
});
```

在任何scss文件中可以直接使用$color 变量
css复制代码color:$color;

### 功能案例五

当然也可以添加postcss plugins 插件 ，可以使用postcssPlugin插件，这里就简单举个例子
比如使用postcss-preset-env 这个postcss 插件

```js
import postcssPresetEnv from 'postcss-preset-env';
export default defineConfig({
    plugins: [
        VitePluginOneofCssModule({
            postcssPlugin: [postcssPresetEnv()]
        })
    ]
});
```

如下:

```
user-select: none;
```

将被转换为

```
-webkit-user-select: none;
-moz-user-select: none;
user-select: none;
```

混合使用
当然，你如果在VitePluginOneofCssModule不去匹配这个文件，那该文件是被Vite内置的插件处理的，如下可以混合处理的

```js
import $style from './App.scss';
import './index.scss';
function App() {
    return (
        <div className={$style.app}>
            我是APP
            <div className='header'></div>
            <div className={$style.body}>我是body</div>
        </div>
    );
}
export default App;
```

作者：LVZ
链接：https://juejin.cn/post/7304946588752478271
具体用法可在掘金中查看
