import typescript from 'rollup-plugin-typescript2';

export default {
	input: './app.ts',
	output: {
		sourcemap: true,
		format: 'iife',
		file: 'out/bundle.js',
	},
	plugins: [
		typescript({ sourceMap: false })
	]
}
