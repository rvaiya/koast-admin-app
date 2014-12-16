/* global require, console */

'use strict';

var q = require('q');
var os = require('os');
var fs = require('fs');
var R = require('ramda');
var _ = require('underscore');
var log = require('koast-logger');
var express = require('express');
var request = require('request');
var mongoUri = require('mongo-uri');

var mds = require('mongodump-stream');
var MongoClient = require('mongodb').MongoClient;

var sprawn = require('./sprawn');
var backup = require('./backup/backup');

function collectionToS3(collectionName, key, stream, awsGlobal, awsS3) {
  return mds.dump.s3(key, stream, {
    key: awsGlobal.accessKeyId,
    secret: awsGlobal.secretAccessKey,
    bucket: awsS3.bucket
  }, log.error).then(function(res) {
    return {collection: collectionName,
            url: res.Location}; // TODO
  }, log.error);
}

function allCollectionsToS3(mongoUri, collections, awsGlobal, awsS3, dbCollection) {
  var bid;
  return function(backupId, start) {
    bid = backupId;
    start = new Date(start);

    return mds.slurp.multiBinary(mongoUri, collections, function(stream, coll) {
      
      var d = start.getDate();
      var m = start.getMonth() + 1;
      var y = start.getFullYear();
      var h = start.getHours();
      var m = start.getMinutes();
      var s = start.getSeconds();

      var key = [y, '-', m, '-', d, '-', h, ':', m, ':', s,
           '_', backupId, '_', coll].join('');

      // return promise and resolve location
      return collectionToS3(coll, key, stream, awsGlobal, awsS3);
    }).then(function(data) {
      //backup to mongo hurr

      dbCollection.insert({backupId: bid, data: data}, function(err, result) {
        if(err) { throw err; }
      });

      return data;
    }, log.error);
  };
}

function getS3BackupRouter(target, dbCollection, awsConfig) {
  var storageMechanism = allCollectionsToS3(target.uri, 
                                            target.collections, 
                                            awsConfig.global, 
                                            awsConfig.s3, 
                                            dbCollection);
  backup.createBackup(storageMechanism);
  router.get('/:backupId', backup.retrieveBackupStatus);

  return router;
}

function isArray(val) {
  return val.constructor === Array;
}

function restoreBinaryFromUrl(url, db, collection) {
  var deferred = q.defer();

  var tmpDir = os.tmpdir();
  var now = Date.now();
  var fpath = tmpDir + '/' + now + '.bson';

  var cmd = 'mongorestore';
  var args = ['--db', db, '--collection', collection, fpath];
  
  // make req for file, assume buffer is buf
  var outStream = fs.createWriteStream(fpath);
  request.get(url).pipe(outStream);

  outStream.on('finish', function() {
    sprawn.resolve(cmd, args).then(function() { 
      console.log('done?');
      deferred.resolve();
    });
  });

  return deferred.promise;
}

/**
 * cb should return a promise that resolves when it's done
 */
function getAdminApiRouter(conf) {

  var discoveryData = {};
  discoveryData.backups = {
    start: {
      route: '/backups/start',
      methods: [ 'POST' ]
    },

    stat: {
      route: '/backups/stat/:id',
      methods: [ 'GET' ]
    },

    listAll: {
      route: '/backups/list',
      methods: [ 'GET' ]
    },

    listOne: {
      route: '/backups/list/:id',
      methods: [ 'GET' ]
    }
  };

  var deferred = q.defer();
  
  var router = express.Router();

  if(!conf.backups.mongo.dest) {
    throw 'No destination mongo config present';
  }

  var mongoDestUri = conf.backups.mongo.dest.uri;
  var mongoDestCollection = conf.backups.mongo.dest.collection;

  MongoClient.connect(mongoDestUri, function(err, db) {
    if(err) { throw err; }
  
    if(conf.backups) {
      if(conf.backups.storage) {

        discoveryData.backups = discoveryData.backups || {};
    
        var storages = conf.backups.storage;
        if(!isArray(storages)) {
          throw 'backups.storage is not an Array';
        }

        if(!conf.backups.mongo.target) {
          throw 'No target mongo config present';
        }

        var targetUri = conf.backups.mongo.target.uri;
        if(!targetUri) {
          throw 'No target mongo URI';
        }

        var targetCollections = conf.backups.mongo.target.collections;
        if(!isArray(targetCollections)) {
          throw 'Target collections is not an Array';
        }

        var mongoTargetUriData = mongoUri.parse(targetUri);  

        var destDbCollection = db.collection(mongoDestCollection);

        // Mount S3 backup
        if(_.contains(storages, 's3')) {
          var awsConfig = conf.backups.aws;
          if(!awsConfig) { throw "No AWS config"; }

        //router.use('/backups',
        //            getS3BackupRouter(conf.backups.mongo.target,
        //            destDbCollection,
        //            conf.backups.aws));
        }

        router.post('/start', function(req, res) { 
          var type = req.body.type;
          var id = req.body.id;
          console.log(type);
          console.log(id);
          res.end();

          // Here storage handlers are called, the interface provided by the endpoint
          // should be consistent regardless of the storage mechanism being employed.
        }); //Implement this**

        router.get('/stat', function(req,res) { res.end(); }); //Implement this**

        router.get('/backups/list', function(req,res) {
          destDbCollection.find().toArray(function(err, docs) {
            res.send(docs) 
          });
        });

        router.get('/backups/list/:id', function(req, res) {
          var backupId = req.param('id');
          destDbCollection.findOne({backupId: backupId}, function(err, docs) {
            if(err) { throw err; }
            res.send(docs);
          });
        });

        router.get('/backups/restore/:id', function(req, res) {
          var backupId = req.param('id');
          destDbCollection.findOne({backupId: backupId}, function(err, docs) {
            if(err) { throw err; }
            var promises = _.map(docs.data, function(d) {
              return restoreBinaryFromUrl(d.url, mongoTargetUriData.database, d.collection);
            });

            q.all(promises)
              .then(function() {
                res.send('done'); //TODO better response?
              });
          });
        });

        router.get('/discovery', function(req, res) {
          res.send(discoveryData);
        });

        deferred.resolve(router);
      }
    }

  });

  return deferred.promise;
}


function getEndpointHandler() {
//Opts can contain: 
//
//resourceDescription: (If a resource is being posted to this describes it)
//

  var router: express.Router(),
  var endpoints: {};

  return {

    register: function(module, method, handler, opts) {
      opts = opts || {};
      opts.reqType = opts.reqType || 'GET';

      var url = module + '/' + method;

      for(var param in opts.resourceDescription) {
        url += '/:' + param 
      }

      router['get'](url, function(req, res) {
          handler((req === 'POST') ? req.body : null)
            .then(function(payload) {
              res.json(payload)
            }, function(e) {
              res.status(500).end();
              log.error(e);
            });
      });

      endpoints[module][method] = 
      {
        handler: handler,
      }
    },

    getRouter: function() {
     var discovery = {};
     for(var module in endpoints) {
       for(var f in module) {
         discovery[module][f]
       }
     }
     return router; 
    };
  };
};
endpointHandler.generateDiscovery();

exports = module.exports = {
  getRouter: getAdminApiRouter,
};
