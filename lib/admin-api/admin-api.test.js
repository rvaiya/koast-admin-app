'use strict';

var q = require('q');
var log = require('koast-logger');
var express = require('express');
var supertest = require('supertest');

var adminApi = require('./admin-api');

var targetMongoUri = 'mongodb://localhost:27017/dumptestdb';

var access = process.env.AWS_ACCESS;
var secret = process.env.AWS_SECRET;
var bucket = process.env.AWS_S3_BUCKET;


describe('Invalid configurations', function() {
  //TODO
});

describe('Mongo destination', function() {
  it('Should do stuff', function(done) {

    this.timeout(5000);

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

    adminApi.getRouter(conf).then(function(adminRouter) {
      var app = express();
      app.use('/', adminRouter);

      var st = supertest(app);

      st.post('/backups/s3')
        .end(function(err, res) {
          setTimeout(function() {
            st.get('/backups/s3/' + res.body.id)
              .end(function(err, res) {
                console.log(err, res.body);
              });
          }, 3000);
        });
    }, log.error);


  });
});
