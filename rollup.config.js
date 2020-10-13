import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';

export default {
	input: './src/app.ts',
	output: {
		sourcemap: true,
		format: 'iife',
		file: 'out/bundle.js',
	},
	plugins: [
		typescript({ sourceMap: false }),
		resolve(),
	],
}
