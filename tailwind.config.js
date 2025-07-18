/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Primary theme colors - Lavender (Tím Lavender)
        primary: {
          50: '#f8f5ff',
          100: '#f0ebff',
          200: '#e5d9ff',
          300: '#d1bbff',
          400: '#b794ff',
          500: '#9d6eff',
          600: '#8347ff',
          700: '#6d2eff',
          800: '#5a1fff',
          900: '#4a0dff',
          // Main lavender color from image
          main: '#c3a6cb', // RGB: 195/166/203
        },
        // Secondary theme colors - Pink (Hồng Phấn)  
        secondary: {
          50: '#fef7f7',
          100: '#fdf0f0',
          200: '#fde4e4',
          300: '#fcd1d1',
          400: '#f9b3b3',
          500: '#f59090',
          600: '#ef6a6a',
          700: '#e74c4c',
          800: '#c0392b',
          900: '#a93226',
          // Main pink color from image
          main: '#ffc8de', // RGB: 225/200/222
        },
        // Keep success/warning/danger but update with theme
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        }
      }
    },
  },
  plugins: [],
}
