/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0B0C10',
          dark: '#0B0C10',
          card: '#121418',
          surface: '#121418',
        },
        primary: {
          DEFAULT: '#FFFFFF',
          text: '#FFFFFF',
        },
        electric: {
          DEFAULT: '#1E6BFF',
          blue: '#1E6BFF',
          hover: '#1456d6',
        },
        amber: {
          alert: '#EAB308',
        },
        muted: {
          DEFAULT: '#9CA3AF',
          text: '#9CA3AF',
        },
      },
    },
  },
  plugins: [],
};
