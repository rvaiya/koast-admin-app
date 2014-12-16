/* global require,process, exports*/
/** @module koast/config */
// A config loader module.
//
// This should not actually contain any configurations, but rather provides a
// getConfig(key) method that would retrieves specific configurations from
// files.
'use strict';
var fs = require('fs');
var expect = require('chai').expect;
var configDirectory;
var cachedConfigs = {};
var commonConfigDir = 'common'; //TODO ability to set this
var commonConfig = {};
var log = require('./log');
var shortstop = require('shortstop');
var handlers = require('shortstop-handlers');
var shortresolve = require('shortstop-resolve');
var Q = require('q');
var path = require('path');
var confit = require('confit');
var config = {};
var steeltoe = require('steeltoe');
var _ = require('underscore');

var _configurationInfo = {
  base: {
    defaultSource: '',
    environmentSource: '',
    default: {
      preProcessed: {},
      postProcessed: {},
    },
    environment: {
      preProcessed: {},
      postProcessed: {}
    }

  },
  app: {
    defaultSource: '',
    environmentSource: '',
    default: {
      preProcessed: {},
      postProcessed: {},
    },
    environment: {
      preProcessed: {},
      postProcessed: {}
    },
  },
  result: {}
};

var _ = require('underscore');
var whenReady = Q.defer();


function demandEnvironment() {
  if (!process.env.NODE_ENV) {
    throw 'Environment is not set.';
  }
}

function readJsonFromFile(fullPath) {
  if (fs.existsSync(fullPath)) {
    return JSON.parse(fs.readFileSync(fullPath));
  }
}

function configPath(prefix) {
  return path.join(prefix, 'config');
}

function getShortstopHandlers(options) {
  var result;
  result = {
    file: handlers.file(options.basedir),
    path: handlers.path(options.basedir),
    base64: handlers.base64(),
    env: handlers.env(),
    require: handlers.require(options.basedir),
    exec: handlers.exec(options.basedir),
    glob: handlers.glob(options.basedir),
    resolve: shortresolve(options.basedir)
  };
  return result;
}



function populatePostProcessed(section, options, config) {

  section.defaultSource = options.basedir + '/' + options.defaults;
  section.default.preProcessed = readJsonFromFile(section.defaultSource);
  section.environment.postProcessed = getResultingConfiguration(config);
  section.environmentSource = options.basedir +
    '/' +
    config.get('env:env') + '.json';

  section.environment.preProcessed = readJsonFromFile(section.environmentSource);

  //)
  var resolver = getResolver(options.protocols);
  resolver = Q.nbind(resolver.resolve, resolver);
  return resolver(section.default.preProcessed).then(function (postProcessed) {
    section.default.postProcessed = postProcessed;
    return section;
  });
}

function prepareConfigurationInfo(baseOptions, appOptions) {
  return function (baseConfig, appConfig) {
    return Q.all([
        populatePostProcessed(_configurationInfo.app, appOptions,
          appConfig),
        populatePostProcessed(_configurationInfo.base, baseOptions,
          baseConfig)
      ])
      .then(function () {
        return [baseConfig, appConfig];
      });
  };
}

function loadConfig(enviroment, options) {
  var koastDir = configPath(path.dirname(__dirname));
  var appDir = configPath(options.appBasedir) || configPath(process.cwd());

  var appFactory;
  var baseFactory;
  var baseOptions;
  var appOptions;
  var basePromise;
  var appPromise;


  baseOptions = {
    basedir: options.basedir || koastDir,
    defaults: options.file || 'app.json'
  };

  log.verbose('koast-base logging options:', baseOptions);



  appOptions = {
    basedir: appDir,
    defaults: options.file || 'app.json'
  };

  log.verbose('koast application-level logging options', appOptions);

  baseOptions.protocols = getShortstopHandlers(baseOptions);
  appOptions.protocols = getShortstopHandlers(appOptions);

  baseFactory = confit(baseOptions);
  appFactory = confit(appOptions);

  basePromise = Q.nbind(baseFactory.create, baseFactory);
  appPromise = Q.nbind(appFactory.create, appFactory);


  return Q.all([basePromise(), appPromise()])
    .spread(prepareConfigurationInfo(baseOptions, appOptions))
    .spread(function (baseConfig, appConfig) {

      baseConfig.merge(appConfig);

      _configurationInfo.result = getResultingConfiguration(baseConfig);
      config = baseConfig;
      config._configurationInfo = _configurationInfo;


      return config;
    }).then(null, function (err) {
      log.error('Error loading configuration:', JSON.stringify(err));
      throw new Error(err);
    });


}

function getResolver(protocols) {
  var resolver = shortstop.create();
  Object.keys(protocols).forEach(function (protocol) {
    resolver.use(protocol, protocols[protocol]);
  });
  return resolver;

}

function mergeOptionsIntoConfig(baseConfig, baseOptions, appOptions) {

  log.debug('Base options being merged', baseOptions);
  log.debug('App options being merged', appOptions);

  _configurationInfo.base.environment.postProcessed = baseOptions;
  _configurationInfo.app.environment.postProcessed = appOptions;

  baseConfig.use(baseOptions);
  baseConfig.use(appOptions);


  return baseConfig;
}

function getResultingConfiguration(config) {
  var configuration = {};
  var keys = Object.keys(config._store);
  keys = keys.splice(keys.indexOf('env') + 1, keys.length);
  keys.forEach(function (i) {
    if (typeof config._store[i] === 'object') {
      configuration[i] = config._store[i];
    }
  });
  return configuration;
}

function setConfiguration(environment, options) {
  var koastDir = configPath(path.dirname(__dirname));
  var appDir = configPath(options.appBasedir) || configPath(process.cwd());
  var appProtocols;
  var baseProtocols;
  var baseOptions;
  var appOptions;
  var factory;
  var baseResolver;
  var appResolver;

  log.verbose('setting configuration', options);

  options.baseConfiguration = options.baseConfiguration || {};
  options.appConfiguration = options.appConfiguration || {};


  baseOptions = {
    basedir: options.basedir || koastDir,
    defaults: 'empty.json'
  };


  appOptions = {
    basedir: appDir,
    defaults: options.file || 'app.json'
  };

  baseProtocols = getShortstopHandlers(baseOptions);
  appProtocols = getShortstopHandlers(appOptions);


  baseResolver = getResolver(baseProtocols);
  appResolver = getResolver(appProtocols);


  baseOptions.protocols = baseProtocols;
  appOptions.protocols = appProtocols;

  factory = confit(baseOptions);

  _configurationInfo.base.options = baseOptions;
  _configurationInfo.app.options = appOptions;

  var baseResolve = Q.nbind(baseResolver.resolve, baseResolver);
  var appResolve = Q.nbind(appResolver.resolve, appResolver);
  var configCreate = Q.nbind(factory.create, factory);

  _configurationInfo.base.defaultSource = 'n/a';
  _configurationInfo.app.defaultSource = 'n/a';
  _configurationInfo.base.environmentSource = 'provided';
  _configurationInfo.app.environmentSource = 'provided';
  _configurationInfo.app.environment.preProcessed = options.appConfiguration;
  _configurationInfo.base.environment.preProcessed = options.baseConfiguration;

  return Q.all([configCreate(),
      baseResolve(options.baseConfiguration),
      appResolve(options.appConfiguration)
    ])
    .spread(mergeOptionsIntoConfig)
    .then(function (baseConfig) {
      config = baseConfig;
      return config;
    }).then(function (config) {
      _configurationInfo.result = getResultingConfiguration(config);
      config._configurationInfo = _configurationInfo;
      return config;
    }).then(null, function (err) {
      log.error('Error resolving provided configuration', err);
    });
}

function loadConfiguration(newEnvironment, options) {
  options = options || {};
  if (newEnvironment && !options.force) {
    throw new Error('Cannot change the environment once it was set.');
  } else {
    if (newEnvironment) {
      process.env.NODE_ENV = newEnvironment;
    } else {
      process.env.NODE_ENV = process.env.NODE_ENV || 'dev';
    }

    log.verbose('Setting enviroment to', process.env.NODE_ENV);

    cachedConfigs = {};
    options.appBasedir = configDirectory || process.cwd();

    if (options.baseConfiguration || options.appConfiguration) {
      log.info('Setting configuration from explicitly set options');
      return setConfiguration(process.env.NODE_ENV, options).then(
        function (
          result) {
          whenReady.resolve(result);
          return result;
        });
    } else {
      return loadConfig(process.env.NODE_ENV, options).then(function (
        result) {
        whenReady.resolve(result);
        return result;
      });
    }


  }
}


/**
 * @function loadConfiguration
 * @static
 * Loads the configuration for an enviroment.
 * Will load the base koast configuration from koast/config/app.json and merge in the application level configuration.
 * If no paramaters are defined, will look in your application/config/app.json for common settings, and will merge in
 * application/config/enviornment.json settings for application and environment specific settings.
 * @param {string} [newEnvironment] - name of environment to load configuration for.  If no paramater is passed, will default to NODE_ENV or development.
 * @param {object} [options] - options to pass into
 * @param {boolean} [options.force] - force configuration to reload even after the environment has been defined
 * @param {object} [options.baseConfiguration] - force application to use provided configuration as base settings
 * @param {object} [options.appConfiguration] - force application to use provided configuration as application settings
 * @returns a {Promise} of the configuration object
 *
 * @example Using default configuration options
 *
 * koast.config
 * .loadConfiguration()
 * .then(koast.serve)
 *
 * @example Specifying configuration to use explicitly - useful for setting up tests without needing to manage configuration files
 *
 * var options = {
 *  force: true,
 *  appConfiguration: {
 *    app: {
 *     port: 2601,
 *     someKey: 'myValue'
 *    }
 *  }
 * };
 *
 * koast.config.loadConfiguration('myTest',options)
 * .then(koast.serve)
 */
exports.loadConfiguration = loadConfiguration;

/** Promise that resolves when application is ready
 * @example
 * koast.config.loadConfiguration();
 * koast.config.whenReady(function()
 * {
 * // stuff that relies on configuration being loadede
 * }
 **/
exports.whenReady = whenReady.promise;
/**
 * Set base path for config directory.
 * @param  {String}  newConfigDirectory  The new config directory
 * @param  {Object}  options             Options of some sort. (TODO figure this out)
 */
exports.setConfigDirectory = function (newConfigDirectory, options) {
  options = options || {};
  if (configDirectory && !options.force) {
    throw new Error('Cannot change the config directory once it was set.');
  } else {
    configDirectory = newConfigDirectory;
  }
};
/**
 * Get a specific set of configuration values from cache or a file.
 * @param  {String}  key  Name of configuration you want.
 * @param  {boolean}  ignoreCache  Skip the cache and load the configuration
 *                                 directly from disk.
 */
exports.getConfig = function (key, ignoreCache) {
  try {
    var result = (key) ? config.get(key) : config;

    if (!result) {
      // TODO: figure out what to do when loading config that wasn't there during
      // app init.
      var path = process.cwd() + '/config/' + process.env.NODE_ENV + '/' + key + '.json';

      result = readJsonFromFile(path);
      config.set(key, result);
    }

    return result;
  } catch (err) {
    log.error('Error occured in getConfig, did you wait for the ' +
      'configuration loader to finish? Remember: ' +
      'koast.config.loadConfiguration() returns a promise!');
    log.error(err);
  }
};
