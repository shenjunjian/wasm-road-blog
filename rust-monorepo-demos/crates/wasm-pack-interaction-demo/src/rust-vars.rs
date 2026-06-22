// 在这里定义一些 rust侧的js变量，并能返回给JS侧使用， 然后在lib.rs中引入本模块。
// 这里的导出给Js的函数，可以被JS侧调用， JS侧代码在`wasm-road-demo\apps\wasm-pack-interactive-demo-page` 工程中补全

// 1. 基本js变量，  null, bool , number, string, array, object, symbol, bigint, promise, 可以使用 wasm-bindgen 和 js-sys 来定义。

// 2. 使用 web-sys 来访问页面的DOM元素， 比如 document, window, body, html, etc. 并创建的dom .

// 3. 使用 fetch 来获取网络资源， 比如图片。 返回给js侧

// 4. 使用 serde-wasm-bindgen 来序列化/反序列化 js值.

// 5.  使用 js-sys的 futures 模块， 创建一个promise， 并返回给js侧使用。

// 6. 使用skia-canvas  库绘制一个正方形和 'helloworld' 字符串。然后将二进制的buffer 返回给js侧， 渲染到canvas上。
