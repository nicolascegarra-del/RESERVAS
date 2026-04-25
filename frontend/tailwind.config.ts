import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        klyp: {
          navy: "#051937",
          "navy-light": "#1A3A6B",
          accent: "#2E6DB4",
          pale: "#E8EDF5",
          gray: "#6B7280",
          "text-dark": "#374151",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Nunito", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
