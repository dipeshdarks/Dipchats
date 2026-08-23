/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dipBg: '#0B0F14',
        dipPanel: '#111827',
        dipCard: '#161B22',
        dipBorder: '#1F2937',
        dipPrimary: '#4F8CFF',
        dipPrimaryHover: '#3B76E8',
        dipSuccess: '#22C55E',
        dipWarning: '#F59E0B',
        dipDanger: '#EF4444',
        dipText: '#FFFFFF',
        dipSecondary: '#94A3B8'
      }
    }
  },
  plugins: []
};
