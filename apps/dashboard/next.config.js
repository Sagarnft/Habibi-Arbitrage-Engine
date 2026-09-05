"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_path_1 = __importDefault(require("node:path"));
const nextConfig = {
    turbopack: {
        root: node_path_1.default.resolve(process.cwd(), "../.."),
    },
    assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || "",
};
module.exports = nextConfig;
