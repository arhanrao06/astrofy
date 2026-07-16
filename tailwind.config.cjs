/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {},
	},
	plugins: [require("@tailwindcss/typography"),require("daisyui")],
	daisyui: {
		themes: [
			{
				sunrise: {
					"primary": "#F97316",          // orange
					"primary-content": "#ffffff",
					"secondary": "#EC4899",        // pink
					"secondary-content": "#ffffff",
					"accent": "#8B5CF6",           // violet
					"accent-content": "#ffffff",
					"neutral": "#2A211C",          // warm near-black
					"neutral-content": "#FAF6F2",
					"base-100": "#FFFDFB",         // page background (warm white)
					"base-200": "#FFF4EC",         // sidebar / cards (warm cream)
					"base-300": "#FFE7D6",         // borders / hover
					"base-content": "#2A211C",     // main text
					"info": "#0EA5E9",
					"success": "#22C55E",
					"warning": "#F59E0B",
					"error": "#EF4444",
					"--rounded-box": "1rem",
					"--rounded-btn": "0.6rem",
					"--rounded-badge": "1.9rem",
				},
			},
			"dark", // keeps a built-in dark theme available as a fallback
		],
		darkTheme: "dark",
		logs: false,
	}
}
