'use strict';

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

//FIX this so it creates a complete koast app with the appropriate middleware

function getWorkingApp() {
  var conf = {
    backups: {
      storage: ['s3', 'fs'],
      mongo: {
        target: {
          uri: targetMongoUri,
        
          dest: {
            uri: 'mongodb://localhost:27017/dumptestdb',
            collection: 'backuplocations'
          }
      },

      s3: {
        accessKeyId: access,
        secretAccessKey: secret
        bucket: bucket
      }
    }
  };

  return adminApi.getRouter(conf).then(function(adminRouter) {
    var app = express();
    app.use(bodyParser.json());
    app.use('/', adminRouter);
    return app;
  });
};

describe('Invalid configurations', function() {
  //TODO
});

describe('Mongo destination', function() {
  xit('Should do stuff', function(done) {

    this.timeout(5000);

    getWorkingApp().then(function(app) {

      var st = supertest(app);

      st.post('/backups/s3')
        .end(function(err, res) {
          setTimeout(function() {
            st.get('/backups/s3/' + res.body.id)
              .end(function(err, res) {
                if(res.body.success) {
                  st.get('/backups/list/' + res.body.id)
                    .end(function(err, res) {
                      
                      if(_.contains(_.pluck(res.body.data, 'collection'),
                          'multi_a')) {
                      
                        done();
                      }
                    });
                }
              });
          }, 2000);
        });
    }, log.error);


  });


  xit('Should list all backups', function(done) {

    getWorkingApp().then(function(app) {
      var st = supertest(app);
      st.get('/backups/list')
        .end(function(err, res) {
          var last = _.last(res.body);
          if(last.hasOwnProperty('backupId') && last.hasOwnProperty('data')) {
            done();
          }
        });
    });

  });

  it.only('Should have a working start route', function(done) {
    getWorkingApp().then(function(app) {
      supertest(app)
        .post('/start')
        .send({ type: 'pong' })
        .set('content-type', 'application/json')
        .end(function(err, res) {
          if(err) throw err;
          console.log(res.body);
          done();
        });
    });
  });

  it('Should have discovery route', function(done) {
    getWorkingApp().then(function(app) {
      var st = supertest(app);
      st.get('/discovery')
        .end(function(err, res) {
          if(err) throw err;
          console.log(res.data);
          done();
        });
    });
  });

  it('Should restore', function(done) {
    getWorkingApp().then(function(app) {
      var st = supertest(app);
      st.get('/backups/restore/ae4869d0-8432-11e4-b34a-179ca0850f6f')
        .end(function(err, res) {
          console.log(res.body);
        });
    });
  });
});
