/* global require, console */
var q = require('q');
var _ = require('underscore');
var uuid = require('uuid');
var mongoose = require('mongoose');

var log = require('../../log');

'use strict';

var liveBackups = {};


// This API sucks (get collection from req?)
//
// colls - Array of collections to backup
//
// storageHandler must implement a store method which consumes an id
// and a start time and return a promise which resolves to (make this cleaner)**
function createBackup(storageHandler) {
    //TODO make assertions on parameters
  
    var backupId = uuid.v1();

    // mark as live
    liveBackups[backupId] = {
      finished: false,
      id: backupId,
      start: Date.now()
    };
    
    storageHandler.store(backupId, liveBackups[backupId].start)
      .then(function(data) {
        liveBackups[backupId].finished = true;
        liveBackups[backupId].success = true;
        liveBackups[backupId].end = Date.now();
        liveBackups[backupId].data = data;
      }, function(err) {
        log.error(err);
        liveBackups[backupId].finished = true;
        liveBackups[backupId].success = false;
        liveBackups[backupId].end = Date.now();

        throw err; //FIXME
      });
    return liveBackups[backupId];
};

function retrieveBackupStatus(req, res) {
  var backupId = req.param('backupId');
  res.send(liveBackups[backupId]);
}


exports = module.exports = {
  createBackup: createBackup,
  retrieveBackupStatus: retrieveBackupStatus
};

