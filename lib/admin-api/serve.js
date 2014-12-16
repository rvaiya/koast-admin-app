var q = require('q');
var _ = require('underscore');
var log = require('koast-logger');
var express = require('express');
var supertest = require('supertest');
var bodyParser = require('body-parser');

var adminApi = require('./admin-api');

var targetMongoUri = 'mongodb://localhost:27017/koast1';

var access = process.env.AWS_ACCESS;
var secret = process.env.AWS_SECRET;
var bucket = process.env.AWS_S3_BUCKET;


function getWorkingApp() {

  var conf = {
    backups: {
      storage: ['s3', 'fs'],
      mongo: {
        target: {
          uri: targetMongoUri,
          collections: ['multi_a', 'multi_b']   
        },
        
        dest: {
          uri: 'mongodb://localhost:27017/dumptestdb',
          collection: 'backuplocations'
        }
      },

      aws: {
        global: {
          accessKeyId: access,
          secretAccessKey: secret
        },

        s3: {
          bucket: bucket
        }
      }
    }
  };

  return adminApi.getRouter(conf).then(function(adminRouter) {
    var app = express();
    app.use(bodyParser.json());
    app.use('/', adminRouter);
    return app;
  });
}


console.log('here');
getWorkingApp().then(function(app) {
  console.log('have app');
  app.listen(8080, function() {
    console.log('listening on port ' + 8080);
  });
});
