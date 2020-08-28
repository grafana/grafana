const loaderUtils = require('loader-utils');

const WebWorkerTemplatePlugin = require('webpack/lib/webworker/WebWorkerTemplatePlugin');
const ExternalsPlugin = require('webpack/lib/ExternalsPlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

const COMPILATION_METADATA = Symbol('COMPILATION_METADATA');

module.exports.COMPILATION_METADATA = COMPILATION_METADATA;

module.exports.pitch = function pitch(remainingRequest) {
  const { target, plugins = [], output, emit } = loaderUtils.getOptions(this) || {};

  if (target !== 'worker') {
    throw new Error(`Unsupported compile target: ${JSON.stringify(target)}`);
  }

  this.cacheable(false);

  const { filename, options = {} } = getOutputFilename(output, { target });

  // eslint-disable-next-line no-underscore-dangle
  const currentCompilation = this._compilation;

  const outputFilename = loaderUtils.interpolateName(this, filename, {
    context: options.context || currentCompilation.options.context,
    regExp: options.regExp,
  });

  const outputOptions = {
    filename: outputFilename,
    chunkFilename: `${outputFilename}.[id]`,
    namedChunkFilename: null,
  };

  const compilerOptions = currentCompilation.compiler.options;
  const childCompiler = currentCompilation.createChildCompiler('worker', outputOptions, [
    // https://github.com/webpack/webpack/blob/master/lib/WebpackOptionsApply.js
    new WebWorkerTemplatePlugin(outputOptions),
    new LoaderTargetPlugin('webworker'),
    ...(this.target === 'web' || this.target === 'webworker' ? [] : [new NodeTargetPlugin()]),

    // https://github.com/webpack-contrib/worker-loader/issues/95#issuecomment-352856617
    ...(compilerOptions.externals ? [new ExternalsPlugin(compilerOptions.externals)] : []),

    ...plugins,

    new SingleEntryPlugin(this.context, `!!${remainingRequest}`, 'main'),
  ]);

  const subCache = `subcache ${__dirname} ${remainingRequest}`;

  childCompiler.plugin('compilation', compilation => {
    if (!compilation.cache) {
      return;
    }
    if (!(subCache in compilation.cache)) {
      Object.assign(compilation.cache, { [subCache]: {} });
    }
    Object.assign(compilation, { cache: compilation.cache[subCache] });
  });

  const callback = this.async();

  childCompiler.runAsChild((error, entries, compilation) => {
    if (error) {
      return callback(error);
    }
    if (entries.length === 0) {
      return callback(null, null);
    }
    const mainFilename = entries[0].files[0];
    if (emit === false) {
      delete currentCompilation.assets[mainFilename];
    }
    callback(null, compilation.assets[mainFilename].source(), null, {
      [COMPILATION_METADATA]: entries[0].files,
    });
  });
};

function getOutputFilename(options, { target }) {
  if (!options) {
    return { filename: `[hash].${target}.js`, options: undefined };
  }
  if (typeof options === 'string') {
    return { filename: options, options: undefined };
  }
  if (typeof options === 'object') {
    return {
      filename: options.filename,
      options: {
        context: options.context,
        regExp: options.regExp,
      },
    };
  }
  throw new Error(`Invalid compile output options: ${options}`);
}
