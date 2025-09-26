/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1f3f76',
        accent: '#f97316',
        neutral: '#1f2933',
      },
      boxShadow: {
        soft: '0 4px 16px rgba(31, 47, 91, 0.15)',
      },
    },
  },
  plugins: [],
};
