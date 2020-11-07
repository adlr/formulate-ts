import commonjs from 'rollup-plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import svg from 'rollup-plugin-svg';
import path from 'path';

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
		commonjs({
			namedExports: {
        Parchment: 'default'
      },
		}),
		svg(),
	],
	moduleContext: {[path.resolve('./node_modules/parchment/dist/parchment.js')]: "window"},

}
