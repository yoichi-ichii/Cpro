/// <binding BeforeBuild='Run - Development' />
const webpack = require('webpack');
const path = require('path');
const nodeExternals = require("webpack-node-externals");
const FsWebpackPlugin = require('fs-webpack-plugin');

module.exports = {
    // モード値を production に設定すると最適化された状態で、
    // development に設定するとソースマップ有効でJSファイルが出力される
    mode: "development",
    devtool: "source-map",
    entry: "./src/main.ts",
    // ファイルの出力設定
    output: {
        //  出力ファイルのディレクトリ名
        path: `${__dirname}/dist`,
        // 出力ファイル名
        //filename: "main.js"R
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /.ts$/,
                use: 'ts-loader'
            },
        ]
    },
    // import 文で .ts ファイルを解決するため
    resolve: {
        extensions: [".ts", ".js", ".json"]
    },
    devtool: false,
    plugins: [
        new webpack.SourceMapDevToolPlugin({
            filename: "[file].map",
            fallbackModuleFilenameTemplate: '[absolute-resource-path]',
            moduleFilenameTemplate: '[absolute-resource-path]'
        })
    ],
    //target: 'node',
    //externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
};
