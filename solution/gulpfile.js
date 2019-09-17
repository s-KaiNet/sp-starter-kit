'use strict';

const gulp = require('gulp');
const build = require('@microsoft/sp-build-web');
build.addSuppression(`Warning - [sass] The local CSS class 'ms-Grid' is not camelCase and will not be type-safe.`);
build.addSuppression("Warning - [sass] The local CSS class '-webkit-filter' is not camelCase and will not be type-safe.");
build.addSuppression("Warning - [sass] The local CSS class 'ms-Spinner-label' is not camelCase and will not be type-safe.");
build.addSuppression(/Admins can make this solution available to all sites in the organization/);
build.addSuppression(/Warning - Admins can make this solution available to all sites immediately/);

const path = require('path');
const argv = require('yargs').argv;
const colors = require('colors/safe');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");

const smp = new SpeedMeasurePlugin();

// apply performance fixes only on 'gulp serve --fast' or 'gulp bundle --fast'
const isFast = argv['fast'];

if (isFast) {
  build.log(colors.yellow('*** Applying performance fixes ***'));
  // comment function below to compare performance of gulp bundle or gulp serve without fixes
  applyPerformanceFixes();
}

build.initialize(gulp);

function applyPerformanceFixes() {
  // disable tslint task
  build.tslintCmd.enabled = false;

  // disable typescript task (execute `npm run tsc:watch` in a separate cmd to have typescript support)
  build.tscCmd.enabled = false;
  // optional, add only if typescript incremental build ends after webpack is starting
  //addWaitSubTask();

  build.configureWebpack.mergeConfig({
    additionalConfiguration: (generatedConfiguration) => {
      // use either includeRuleForSourceMapLoader or disableSourceMapLoader
      includeRuleForSourceMapLoader(generatedConfiguration.module.rules);
      //disableSourceMapLoader(generatedConfiguration.module.rules);

      disableMinimizeForCss(generatedConfiguration.module.rules);

      // hard source plugin
      generatedConfiguration.plugins.push(new HardSourceWebpackPlugin());

      useActiveComponent(generatedConfiguration.entry);

      //return smp.wrap(generatedConfiguration);
      return generatedConfiguration;
    }
  });
}

function addWaitSubTask() {
  const wait = build.subTask('wait', function (gulp, buildOptions, done) {
    setTimeout(done, 1000);
  });

  build.rig.addPreBuildTask(wait);
}

// enables only webparts \ bundles listed in active-components.json file
// all others will be disabled
function useActiveComponent(entry) {
  const components = require('./config/active-components.json');
  if (!components || components.length === 0) return;

  const indexPath = path.resolve(__dirname, 'lib/index.js');

  for (const entryKey in entry) {
    if (components.indexOf(entryKey) === -1) {
      entry[entryKey] = indexPath;
    }
  }

}

// disables minification of css for development
function disableMinimizeForCss(rules) {
  for (const rule of rules) {
    if (rule.use
      && rule.use instanceof Array
      && rule.use.length == 2
      && rule.use[1].loader
      && rule.use[1].loader.indexOf('css-loader') !== -1) {
      rule.use[1].options.minimize = false;
    }
  }
}

// sets include rule for source-map-loader to load source maps only for your sources, i.e. files from src/ folder
function includeRuleForSourceMapLoader(rules) {
  for (const rule of rules) {
    if (rule.use && typeof rule.use === 'string' && rule.use.indexOf('source-map-loader') !== -1) {
      rule.include = [
        path.resolve(__dirname, 'lib')
      ]
    }
  }
}

// completely removes source map loader, in that case only transpiled code will be available while debugging (not original TypeScript sources)
function disableSourceMapLoader(rules) {
  let indx = -1;
  for (const rule of rules) {
    if (rule.use && typeof rule.use === 'string' && rule.use.indexOf('source-map-loader') !== -1) {
      indx = rules.indexOf(rule);
      break;
    }
  }

  if (indx !== -1) {
    rules.splice(indx, 1);
  }
}
