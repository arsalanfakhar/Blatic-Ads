import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f5f5',
          100: '#e8e8e8',
          200: '#dedede',
          300: '#c0c0c0',
          400: '#888888',
          500: '#666666',
          600: '#1a1a1a',
          700: '#000000',
          800: '#000000',
          900: '#000000',
        },
        surface: '#f5f5f5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
