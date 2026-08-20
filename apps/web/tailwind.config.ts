import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#17212b", mint: "#b8f2d0", coral: "#ff816d", paper: "#f5f1e9" } } }, plugins: [] };
export default config;
