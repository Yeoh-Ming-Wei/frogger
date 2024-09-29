"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const html_webpack_plugin_1 = __importDefault(require("html-webpack-plugin"));
const config = {
    mode: "development",
    entry: {
        main: "./src/main.ts",
    },
    devtool: "inline-source-map",
    devServer: {
        static: (0, path_1.join)(__dirname, "build"),
        client: {
            overlay: true,
        },
        historyApiFallback: true,
        port: 4000,
        open: true,
        hot: true,
    },
    stats: {
        version: false,
        hash: false,
        entrypoints: false,
        assets: false,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        filename: "[name].js",
        path: (0, path_1.resolve)(__dirname, "dist"),
    },
    plugins: [
        new html_webpack_plugin_1.default({
            template: "./src/index.html",
        }),
    ],
};
exports.default = config;
//# sourceMappingURL=webpack.config.js.map