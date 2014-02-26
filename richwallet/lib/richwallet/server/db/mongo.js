var DB = require('../db');
var config = require('../config');

var MongoClient = require('mongodb').MongoClient;

DB.prototype = {
    connect: function() {
	var self = this;
	MongoClient.connect(config.mongo.url, function(err, conn) {
	    self.conn = conn;
	    self.col = conn.collection('wallet');
	    self.col.ensureIndex({serverKey: 1}, {unique: true}, function(err) { if(err) console.error(err)});
	    self.col.ensureIndex({email: 1}, function(err){if(err) console.error(err);});
	});
    },

    getWalletRecord: function(serverKey, callback) {
	this.col.find({serverKey:serverKey}).toArray(function(err, rets) {
	    if(err) {
		return callback(err);
	    } 
	    var payload = null;
	    if(rets && rets.length > 0) {
		payload = rets[0];
	    }
	    callback(undefined, payload);
	});
    },

    setAuthKey: function(serverKey, authKey, callback) {
	this.col.findAndModify({serverKey:serverKey}, [],
			       {$set: {authKey: authKey}},
			       {upsert: false},
			       function(err, obj) {
				   if(err) {
				       return callback(err);
				   }
				   callback(undefined, true);
			       });
    },

    disableAuthKey: function(serverKey, callback) {
	this.col.findAndModify({serverKey:serverKey}, [],
			       {$unset: {authKey: ""}},
			       function(err, obj) {
				   if(err) {
				       return callback(err);
				   }
				   callback(undefined, true);
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
	var self = this;

	if(!payload || !payload.wallet) {
	    return callback('missing wallet payload');
	}

	this.col.find({'serverKey': serverKey}).toArray(function(err, results) {
	    var origPayload = results[0];
	    payload.serverKey = serverKey;
	    if(!origPayload || origPayload.payloadHash == payload.originalPayloadHash) {
		if(payload.newPayloadHash) {
		    payload.payloadHash = payload.newPayloadHash;
		}
		self.col.update({serverKey: serverKey}, payload, {upsert: true}, function(err, docs){
		    return callback(undefined, {wallet: payload.wallet});
		});
	    } else if(origPayload){
		return callback('out of sync', {wallet: origPayload.wallet});
	    } else {
		console.error('szxxcxcx');
	    }
	});	
    },

    delete: function(serverKey, callback) {
	this.col.remove({serverKey: serverKey}, function(err) {
	    callback(err, true); // FIXME: callback takes true or false
	});
    },

    checkEmailExists: function(email, callback) {
	this.col.find({email: email}).toArray(function(err, results) {
	    if(err) {
		return callback(err);
	    }
	    if(results.length > 0) {
		return callback(undefined, true);
	    } else {
		return callback(undefined, false);
	    }
	});
    }
};

module.exports = DB;
