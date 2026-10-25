/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        auraBg: "#0f172a",
        auraSurface: "#1e293b",
        auraPrimary: "#2563eb",
        auraMuted: "#94a3b8"
      }
    }
  },
  plugins: []
};