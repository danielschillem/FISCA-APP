/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#24a05a',
                    dark: '#1e8048',
                    light: '#e6f9ed',
                },
                danger: '#ef4444',
                warn: '#f97316',
            },
            fontFamily: {
                // Keep Inter as fallback but Segoe UI defined in globals.css takes priority
                sans: ['Segoe UI', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
