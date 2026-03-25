import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import type { RuleSetRule } from 'webpack';

interface SassRuleOptions {
  sourceMap: boolean;
  preserveUrl: boolean;
}

export default function sassRule(options: SassRuleOptions): RuleSetRule {
  return {
    test: /\.(sa|sc|c)ss$/,
    use: [
      {
        loader: MiniCssExtractPlugin.loader,
        options: {
          publicPath: './',
        },
      },
      {
        loader: 'css-loader',
        options: {
          importLoaders: 2,
          url: options.preserveUrl,
          sourceMap: options.sourceMap,
        },
      },
      {
        loader: 'postcss-loader',
        options: {
          sourceMap: options.sourceMap,
          postcssOptions: {
            config: import.meta.dirname,
          },
        },
      },
      {
        loader: 'sass-loader',
        options: {
          sourceMap: options.sourceMap,
          sassOptions: {
            // silencing these warnings since we're planning to remove sass when angular is gone
            silenceDeprecations: ['import', 'global-builtin'],
          },
        },
      },
    ],
  };
}
