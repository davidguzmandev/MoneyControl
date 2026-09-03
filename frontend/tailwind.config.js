/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        income: "#16a34a",
        expense: "#dc2626",
      },
    },
  },
  plugins: [],
};
