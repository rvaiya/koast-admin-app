/**
 * @module lib/config-inspector/summary
 */


var steeltoe = require('steeltoe');
var _ = require('underscore');
var Table = require('cli-table');
var chalk = require('chalk');
var log = require('../../../log');

var columns = {
  P: {
    title: 'path',
    width: 20
  },
  V: {
    title: 'value',
    width: 20
  },
  AD: {
    title: 'app default',
    width: 20
  },
  AE: {
    title: 'app env',
    width: 20
  },
  BD: {
    title: 'base default',
    width: 20
  },
  BE: {
    title: 'base env',
    width: 20
  },
  S: {
    title: 'source',
    width: 5
  },
  SL: {
    title: 'source location',
    width: 40
  },
  SSL: {
    title: 'source',
    width: 45
  }
};

function getWidths(options) {
  return _.chain(Object.keys(options.columns))
    .filter(_.partial(filterColumns, options))
    .map(function (i) {
      return options.columns[i].width;
    }).value();
}

function filterColumns(options, item) {
  return options.include.indexOf(item) >= 0;
}

function getHeaders(options) {

  return _.chain(Object.keys(columns))
    .filter(_.partial(filterColumns, options))
    .map(function (i) {
      return columns[i].title;
    }).value();

}

function getKeyPaths(options) {
  var keys = {
    P: 'path',
    V: 'resultValue',
    S: 'valueSource'
  };

  if (options.display === 'post') {
    keys.AD = 'app.default.postProcessed';
    keys.AE = 'app.environment.postProcessed';
    keys.BD = 'base.default.postProcessed';
    keys.BV = 'base.environment.postProcessed';
  } else {
    keys.AD = 'app.default.preProcessed';
    keys.AE = 'app.environment.preProcessed';
    keys.BD = 'base.default.preProcessed';
    keys.BV = 'base.environment.preProcessed';
  }
  keys.SL = 'valueConfig';
  return keys;
}

function getColumns(options) {

  var keys = getKeyPaths(options);

  return function (item) {
    var data = steeltoe(item);
    var map = {
      'appEnvironment': 'AE',
      'appDefault': 'AD',
      'baseEnvironment': 'BE',
      'baseDefault': 'BD'
    };


    return _.chain(Object.keys(columns))
      .filter(_.partial(filterColumns, options))
      .map(function (currentCol) {
        if (currentCol === 'SSL') {
          var source = map[data.get(keys.S)];
          var sourceLocation = data.get(keys.SL) || '';

          return source + ' - ' + sourceLocation.replace(
            process.cwd(), '');
        } else {
          return data.get(keys[currentCol]);
        }
      }).map(function (i) {

        return i;

      }).value();

  };

}

function cleanInput(arr) {

  arr.push(arr[0]);
  var result = _.chain(arr)
    .map(function (item, index) {

      if (index > 0) {
        return (typeof item === 'undefined' || typeof item === 'object') ?
          '' : item;
      } else {

        var spacer = ' ';
        var result = item;

        item.split('.').forEach(function (item, index) {
          if (index === 0) {
            result = item;
          } else {
            result = spacer + item;
            spacer += ' ';
          }
        });
        return result;


      }
    }).value();
  var path = arr[arr.length - 1];
  //console.log('path is', path);
  result = result.splice(0, result.length - 1);
  result.path = path;
  //console.log("####", result);
  return result;
}

function getTable(configInfo, options) {
  var headers = getHeaders(options);
  var items = _.chain(configInfo)
    .map(getColumns(options))
    .map(cleanInput)
    .value();

  var table = new Table({
    head: headers,
    colWidths: getWidths(options)
  });
  table.push.apply(table, items);
  return table;
}

function getRawResults(configInfo, options) {
  var headers = getHeaders(options);
  var items = _.chain(configInfo)
    .map(getColumns(options))
    .map(function (i) {
      return _.object(_.zip(headers, i));
    }).value();


  return items;
}

/**
 * Displays a summary of configuration information
 * @param  {object} configInfo the configuration debug object generated by configuration-information
 * @param  {string} [options.display] valid options: pre, post - display pre-processed or post-processed values
 * @param  {array}  [options.include] columns to include P = path, V = value, AD = app default, AE = app environment, BD = koast default, KE = koast environment, S = source of the value, SL = location of file for value, SSL = compact S+SL
 * @param  {string} [options.format]  options to define the output format of the summary, 'table' for table summary, raw for a JSON sommary
 * @return {object}
 */
module.exports = function (configInfo, options) {

  var headers;
  var result;
  var defaultOptions = {
    display: 'post',
    include: ['P', 'V', 'SSL'],
    format: 'table',
    columns: columns
  };

  options = options || {};
  _.defaults(options, defaultOptions);

  if (options.format === 'table') {
    result = getTable(configInfo, options);
    result.format = 'table';
  } else if (options.format === 'raw') {
    result = getRawResults(configInfo, options);
    result.format = 'raw';
  }

  return result;
};