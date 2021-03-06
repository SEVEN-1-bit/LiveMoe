import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import UnoCSS from '@unocss/webpack';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';
import path from 'path';

checkNodeEnv('production');
deleteSourceMaps();

export default merge<webpack.Configuration>(baseConfig, {
  devtool: process.env.DEBUG_PROD === 'true' ? 'source-map' : false,

  mode: 'production',

  target: 'web',

  entry: webpackPaths.windowsEntries,

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '../',
    filename: '[chunkhash].renderer.js',
    library: {
      type: 'commonjs2',
    },
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
        include: /\.css$/,
      },
      {
        test: /\.css$/,
        use: ['sass-loader'],
        include: /\.scss$/,
      },
      //Font Loader
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      // SVG Font
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'image/svg+xml',
          },
        },
      },
      // Common Image Formats
      {
        test: /\.(ico|gif|png|jpg|jpeg|webp)$/,
        type: 'asset/resource',
      }
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        extractComments: false,
      }),
      new CssMinimizerPlugin(),
    ],
  },

  plugins: [
    UnoCSS({
      configFile: path.resolve(webpackPaths.rootPath, 'unocss.config.ts'),
    }),

    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
    }),

    new webpack.optimize.SplitChunksPlugin({
      filename: 'react.[chunkhash].js',
      chunks: 'async', // ?????????????????????
      minSize: 30000, // ?????????????????????????????????30k
      maxSize: 0, // ?????????????????????????????????
      minChunks: 1, // ?????????????????????????????????????????????????????????????????????
      maxAsyncRequests: 5, // ??????????????????????????????????????????.???????????????????????????????????????????????????
      maxInitialRequests: 3,
      automaticNameDelimiter: '~',
      cacheGroups: {
        react: {
          name: 'react',
          test: /.*react.*/,
          chunks: 'all',
        },
      },
    }),

    new MiniCssExtractPlugin({
      filename: '[name]/[fullhash].css',
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
    }),

    ...webpackPaths.windowsHtmlPlugins,
  ],

  resolve: {
    alias: {
      '@mui/styled-engine': '@mui/styled-engine-sc',
    },
  },
});
