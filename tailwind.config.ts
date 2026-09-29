import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1e40af', // Deep blue for light mode (blue-800)
          dark: '#1e3a8a',    // Slightly darker blue for dark mode (blue-900)
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Manrope Fallback', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Sora Fallback', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
