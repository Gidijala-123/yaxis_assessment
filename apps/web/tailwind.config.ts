import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0a0e1a",
          900: "#0f1629",
          800: "#1a2340",
          700: "#243058",
          600: "#2e3d6e",
          500: "#3d4f85",
        },
        violet: {
          600: "#5a2278",
          500: "#6f2c92",
          400: "#8d3ab8",
          300: "#b06fd0",
          100: "#ead6f5",
          50: "#f7eefb",
        },
        accent: "#6f2c92",
        ink: "#0f172a",
        muted: "#64748b",
        paper: "#f8fafc",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
