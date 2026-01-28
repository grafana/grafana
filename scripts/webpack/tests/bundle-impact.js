const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

const fixturePath = path.resolve(__dirname, 'bundle-impact-fixture.tsx');
// Create a reasonably large file with many interactive elements to measure impact
const fixtureContent = `
import React from 'react';

export const ManyButtons = () => {
  return (
    <div>
      ${Array(1000).fill(0).map((_, i) => `<button onClick={() => console.log(${i})}>Button ${i}</button>`).join('\n')}
      ${Array(1000).fill(0).map((_, i) => `<a href="#" onClick={() => {}}>Link ${i}</a>`).join('\n')}
    </div>
  );
};
`;

fs.writeFileSync(fixturePath, fixtureContent);

function runWebpack(useLoader) {
  return new Promise((resolve, reject) => {
    const rules = [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'esbuild-loader',
            options: {
                loader: 'tsx',
                target: 'es2015'
            }
          }
        ]
      }
    ];

    if (useLoader) {
      rules[0].use.push({
        loader: path.resolve(__dirname, '../interactive-element-id-loader.js')
      });
    }

    const config = {
      mode: 'production',
      entry: fixturePath,
      output: {
        path: path.resolve(__dirname, 'dist'),
        filename: useLoader ? 'with-loader.js' : 'without-loader.js',
        library: {
            type: 'commonjs'
        }
      },
      module: { rules },
      externals: {
        react: 'react'
      },
      optimization: {
          minimize: false // Disable minimization to see the code and ensure it's not stripped
      }
    };

    webpack(config, (err, stats) => {
      if (err || stats.hasErrors()) {
        reject(err || stats.toString());
      } else {
        resolve(path.resolve(__dirname, 'dist', config.output.filename));
      }
    });
  });
}

(async () => {
  console.log('Running bundle impact test...');
  try {
    const pathWithout = await runWebpack(false);
    const pathWith = await runWebpack(true);

    const sizeWithout = fs.statSync(pathWithout).size;
    const sizeWith = fs.statSync(pathWith).size;

    console.log(`Bundle size without loader: ${sizeWithout} bytes`);
    console.log(`Bundle size with loader:    ${sizeWith} bytes`);
    
    const diff = sizeWith - sizeWithout;
    console.log(`Difference: ${diff} bytes`);
    console.log(`Increase per element (approx 2000 elements): ${diff / 2000} bytes/element`);

    // Clean up
    fs.unlinkSync(fixturePath);
    // fs.rmdirSync(path.resolve(__dirname, 'dist'), { recursive: true });

  } catch (err) {
    console.error('Test failed:', err);
  }
})();
