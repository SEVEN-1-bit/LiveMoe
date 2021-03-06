import webpackPaths from './webpack.paths';
import path from 'path';
import fs from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import type { PluginPackage } from '../../src/common/electron-common/plugin'


let frontendEntries: Record<string, any> = {};
let backendEntries: Record<string, any> = {};
let packagesPath: Record<string, any> = {};
let htmlEntries= [];

// 内置插件入口
 fs.readdirSync(webpackPaths.pluginPath, { withFileTypes: true })
  .filter(Boolean)
  .filter(dir => dir.isDirectory())
  .forEach((dir) => {
    /**
     * 读入插件配置
     */
    const configurationPath = path.join(webpackPaths.pluginPath, dir.name, 'package.json');
    const configuration: PluginPackage = JSON.parse(fs.readFileSync(configurationPath, { encoding: 'utf-8', flag: 'r+' }) || '{}');

    packagesPath[`${dir.name}`] = {
      path: configurationPath,
      name: dir.name,
    };

    if(configuration.pluginType === 'mixin') {
      backendEntries[`${configuration.name}`] = path.join(
        webpackPaths.pluginPath,
        dir.name,
        'backend.ts'
      );
      frontendEntries[`${configuration.name}`] = path.join(
        webpackPaths.pluginPath,
        dir.name,
        'frontend.tsx'
      );
      htmlEntries.push(
        new HtmlWebpackPlugin({
        title: dir.name,
        filename: path.join(dir.name, 'dist','index.html'),
        inject: true,
        templateContent: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title></title>
            </head>
            <body>
              <div id="root"></div>
            </body>
          </html>
        `,
        minify: {
          collapseWhitespace: true,
          removeAttributeQuotes: false,
          removeComments: true,
        },
        isBrowser: false,
        chunks: [configuration.name],
        isDevelopment: process.env.NODE_ENV !== 'production',
        nodeModules: webpackPaths.appNodeModulesPath,
      })
      )

      return;
    }

    if(configuration.pluginType === 'frontend') {
      frontendEntries[`${configuration.name}`] = path.join(
        webpackPaths.pluginPath,
        dir.name,
        'frontend.tsx'
      );

      htmlEntries.push(
        new HtmlWebpackPlugin({
        title: dir.name,
        filename: path.join(dir.name, 'dist','index.html'),
        inject: true,
        templateContent: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title></title>
            </head>
            <body>
              <div id="root"></div>
            </body>
          </html>
        `,
        minify: {
          collapseWhitespace: true,
          removeAttributeQuotes: false,
          removeComments: true,
        },
        isBrowser: false,
        isDevelopment: process.env.NODE_ENV !== 'production',
        chunks: [dir.name],
        nodeModules: webpackPaths.appNodeModulesPath,
      })
      )

      return;
    }

    if(configuration.pluginType === 'backend') {
      backendEntries[`${configuration.name}`] = path.join(
        webpackPaths.pluginPath,
        dir.name,
        'backend.ts'
      );
      return;
    }
  })

export default {
  frontendEntries,
  backendEntries,
  htmlEntries,
  packagesPath
};
