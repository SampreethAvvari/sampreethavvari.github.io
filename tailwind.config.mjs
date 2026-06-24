import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				// Apple-neutral palette: near-white in light, true near-black in dark.
				// Accents (blue, cyan, violet, emerald, amber) are reserved for the
				// hero number or the project name only — never the body.
				'primary': '#FBFBFD',
				'secondary': '#0066CC',
				'accent': '#0040AA',
				'text': '#1D1D1F',
				'dk-primary': '#000000',
				'dk-secondary': '#5B8DEF',
				'dk-accent': '#22D3EE',
				'dk-text': '#F5F5F7',
				// Per-section accents (used as hex in component classes, kept here as a
				// reference for future utilities).
				'acc-cyan':    '#22D3EE',
				'acc-violet':  '#A78BFA',
				'acc-emerald': '#34D399',
				'acc-blue':    '#5B8DEF',
				'acc-amber':   '#F5A524',
				// Filmmaking gets its own cinematic crimson, distinct from the four
				// engineering-discipline accents. The 5th colour out of the prism.
				'acc-film':    '#F43F5E',
			},
			fontFamily: {
				display: [
					'-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
					'"SF Pro Text"', 'Inter', '"Segoe UI"', 'Roboto',
					'"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif',
				],
			},
		},
	},
	darkMode: 'class',
	plugins: [
		typography,
	],
}
