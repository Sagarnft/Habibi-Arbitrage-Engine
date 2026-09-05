"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const BLOCKCHAIN_API_URL = process.env.BLOCKCHAIN_API_URL ?? "http://localhost:4000";
async function GET(request) {
    const { searchParams } = new URL(request.url);
    let path = searchParams.get("path") || "";
    // Remove leading slash if present
    if (path.startsWith("/")) {
        path = path.substring(1);
    }
    try {
        const url = `${BLOCKCHAIN_API_URL}/${path}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        const data = await response.json();
        return server_1.NextResponse.json(data, { status: response.status });
    }
    catch (error) {
        console.error("Blockchain API proxy error:", error);
        return server_1.NextResponse.json({ error: "Failed to reach blockchain API" }, { status: 503 });
    }
}
async function POST(request) {
    const { searchParams } = new URL(request.url);
    let path = searchParams.get("path") || "";
    // Remove leading slash if present
    if (path.startsWith("/")) {
        path = path.substring(1);
    }
    try {
        const body = await request.json().catch(() => ({}));
        const url = `${BLOCKCHAIN_API_URL}/${path}`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        return server_1.NextResponse.json(data, { status: response.status });
    }
    catch (error) {
        console.error("Blockchain API proxy error:", error);
        return server_1.NextResponse.json({ error: "Failed to reach blockchain API" }, { status: 503 });
    }
}
