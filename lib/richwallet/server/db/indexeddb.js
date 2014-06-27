var indexeddb = require('indexeddb-js');
var sqlite3 = require('sqlite3');
var DB = require('../db');
var config = require('../config');

function handleCallback(trans, opts, callback) {
  if(typeof opts == 'function') {
    callback = opts;
    opts = {};
  }
  trans.onsuccess = function(event) {
    var obj = ((opts.successResult != undefined)?
	       opts.successResult:event.target.result);
    callback(undefined, obj);
  };
  trans.onerror = function(event) {
    callback(event.target.error, opts.errorResult);
  };
}

DB.prototype = {
  connect: function(){
    var self = this;
    var engine = new sqlite3.Database(config.backends.indexeddb.sqlite3Path);
    var indexedDB = new indexeddb.indexedDB('sqlite3', engine);
    this.request = indexedDB.open('richwallet');
    this.request.onerror = function(err) {
      console.error(err);
    };

    this.request.onupgradeneeded = function(event) {
      self.db = event.target.result;
      var store = self.db.createObjectStore('wallet',
					    {keyPath: 'serverKey'});
      store.createIndex('email', 'email', {unique: false});
    };
    this.request.onsuccess = function(event) {
      self.db = event.target.result;
    };
  },
  getStore: function(mode) {
    mode = mode || 'readonly';
    return this.db.transaction(null, mode).objectStore('wallet');
  },
  getWalletRecord: function(serverKey, callback) {
    var store = this.getStore();
    handleCallback(store.get(serverKey), callback);
  },

  setAuthKey: function(serverKey, authKey, callback) {
    var self = this;
    this.getWalletRecord(serverKey, function(err, record) {
      if(err)
	return callback(err);
      var store = self.getStore('readwrite');
      record.authKey = authKey;
      handleCallback(store.put(record), {
	successResult: true
      }, callback);
    });
  },
  disableAuthKey: function(serverKey, callback) {
    var self = this;
    this.getWalletRecord(serverKey, function(err, record) {
      if(err)
	return callback(err);
      var store = self.getStore('readwrite');
      delete record['authKey'];
      handleCallback(store.put(record), {
	successResult: true
      }, callback);
    });
  },

  getWallet: function(serverKey, callback) {
    this.getWalletRecord(serverKey, function(err, payload) {
      if(err) {
	return callback(err);
      }
      if(!payload) {
	return callback(undefined, null);
      }
      callback(undefined, payload.wallet);
    });
  },
  
  set: function(serverKey, payload, callback) {
    var store = this.getStore('readwrite');
    var getter = store.get(serverKey);
    getter.onsuccess = function(event) {
      var origPayload = event.target.result;
      if(!!origPayload && origPayload.payloadHash != payload.originalPayloadHash) {
	return callback('outOfSync', {wallet: origPayload.wallet});
      } else {
	if(payload.newPayloadHash) {
	  payload.payloadHash = payload.newPayloadHash;
	}
	for(var key in origPayload) {
	  if(payload[key] == undefined) {
	    payload[key] = origPayload[key];
	  }
	}
	payload.serverKey = serverKey;
	delete payload.newPayloadHash;
	delete payload.originalPayloadHash;

	handleCallback(store.put(payload), {
	  successResult: {wallet:payload.wallet}
	}, callback);
      }
    };
    getter.onerror = function(event) {
      callback(event.target.error);
    };
  },
  delete: function(serverKey, callback) {
    var store = this.getStore('readwrite');
    handleCallback(store.delete(serverKey), {
      successResult: true
    }, callback);
  },
  checkGoogleAuthCode: function(email, callback) {
    var store = this.getStore('readonly');
    var index = store.index('email');
    var cursor = index.openCursor(email);
    cursor.onsuccess = function(event) {
      var cursor = event.target.result;
      if(cursor && cursor.value) {
	if(cursor.value.authKey){
	  callback(undefined, 'AuthCode');
	}
	else{
	  callback(undefined, 'NoAuthCode');
	}
      } else {
	callback(undefined, 'DoesNotExist');
      }
    };
    cursor.onerror = function(event){
      callback(event.target.error);
    };
  },
  checkEmailExists: function(email, callback) {
    var store = this.getStore('readonly');
    var index = store.index('email');
    var cursor = index.openCursor(email);
    cursor.onsuccess = function(event) {
      var cursor = event.target.result;
      if(!cursor) {
	callback(undefined, false);
	return;
      } else {
	callback(undefined, true);
      }
    };
    cursor.onerror = function(event){
      callback(event.target.error);
    };
  },
};

module.exports = DB;
