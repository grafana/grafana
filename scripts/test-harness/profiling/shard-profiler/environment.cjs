'use strict';

const path = require('node:path');
const { Recorder, readConfig, attachRecorder, finalizeConstructorFailure } = require('./recorder.cjs');
const profileConfig = readConfig();
const baseEnvironment = profileConfig.baseEnvironment || path.join(profileConfig.rootDir, 'public/test/happy-dom-environment.js');
const exported = require(baseEnvironment);
const BaseEnvironment = typeof exported === 'function' ? exported : exported?.TestEnvironment ?? exported?.default;
if (typeof BaseEnvironment !== 'function') {
  throw new TypeError(`Shard profile base environment ${baseEnvironment} must export a class, TestEnvironment, or default constructor`);
}

module.exports = class ShardProfileEnvironment extends BaseEnvironment {
  constructor(config, context) {
    const recorder = new Recorder(profileConfig, {
      suite: context.testPath,
      environment: `${BaseEnvironment.name} (${baseEnvironment})`,
      coverageStart: 'environment',
    });
    try {
      super(config, context);
    } catch (error) {
      finalizeConstructorFailure(recorder);
      throw error;
    }
    attachRecorder(this, recorder);
    recorder.measure(() => recorder.point('environment_constructed'));
  }
};
