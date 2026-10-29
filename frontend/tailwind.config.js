/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clinic: {
          teal: "#0f766e",
          dark: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};
