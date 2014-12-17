var DB = require('../db');
var config = require('../config');

var MongoClient = require('mongodb').MongoClient;

DB.prototype = {
  connect: function() {
    var self = this;
    MongoClient.connect(config.backends.mongodb.url, function(err, conn) {
      self.conn = conn;
      self.col = conn.collection('wallet');
      self.colreset_auth = conn.collection('reset_auth');
      self.col.ensureIndex({serverKey: 1}, {unique: true}, function(err) { if(err) console.error(err)});
      self.col.ensureIndex({email: 1}, function(err){if(err) console.error(err);});
      self.col.ensureIndex({addresses: 1}, function(err){if(err) console.error(err);});
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

  getWalletRecordByEmail : function(email, callback) {
    this.col.find({email:email}).toArray(function(err, rets) {
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

checkAuthExistsByEmail: function(email, callback) {
    this.col.find({email:email}).toArray(function(err, rets) {
      if(err) {
	    return callback(err);
      } 

      if(rets!=undefined && rets.length > 0 && rets[0].authKey != undefined && rets[0].authKey.length > 0) {
        callback(undefined, rets[0].authkey)
      } else {
        callback(new Error("No AuthKey"), "");
      }
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
      if(!!origPayload && origPayload.payloadHash != payload.originalPayloadHash) {
	return callback('outOfSync', {wallet: origPayload.wallet});
      } else {
	if(payload.newPayloadHash) {
	  payload.payloadHash = payload.newPayloadHash;
	}
	delete payload.newPayloadHash;
	delete payload.originalPayloadHash;
	self.col.update({serverKey: serverKey}, {$set: payload}, {upsert: true}, function(err, docs){
	  return callback(undefined, {wallet: payload.wallet});
	});
      }
    });
  },

  delete: function(serverKey, callback) {
    this.col.remove({serverKey: serverKey}, function(err) {
      callback(err, true); // FIXME: callback takes true or false
    });
  },

  checkGoogleAuthCode: function(email, serverKey, callback) {
    this.col.find({email: email, serverKey: serverKey}).toArray(function(err, results) {
      if(err) {
	return callback(err);
      }
      if(results && results.length > 0) {
	var payload = results[0];
	    if(payload.authKey){
	      return callback(undefined, 'AuthCode');
	    }
	    else{
	      return callback(undefined, 'NoAuthCode');
	    }
      } else {
		return callback(undefined, 'DoesNotExist');
      }
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
  },
  
  getEmailAddresses: function(email, callback) {
	this.col.find({email: email}).toArray(function(err, results) {
      if(err) {
		return callback(err);
      }
      if(results.length > 0) {
		return callback(undefined, results[0]['addresses']);
      } else {
		return callback(undefined, []);
      }
	});
  },

  setReset: function(email,code,lang, callback) {
    var colreset_auth = this.colreset_auth
    colreset_auth.find({email:email}).toArray(function(err, results) {
      if (err) {
        console.log(err.message)
        return callback(err)
      } 
      if (results.length == 0 || results==undefined) {
        colreset_auth.insert({email:email, reqtime: new Date(), state: "emailsent", code: code, lang:lang, waitdays:5}, function(err, results) {
          if (err) {
            console.log(err.message)
            return callback(err)
          }
        })
        return callback(undefined, "Check your email recently received in last five days from openblock.com and input verify code from email")
      } else {
        if (results[0].state === "emailchecked") {
          return callback(new Error("Already requested before"))
        } else  if( results[0].state === "expired" || results[0].state === "processed"){
	      colreset_auth.update({email: email}, {$set: {reqtime: new Date() ,state:"emailsent", code:code, lang:lang, waitdays : 5}}, function(err, docs){
	        return callback(undefined,  "Check your email recently received in last five days from openblock.com and input verify code from email");
	      })} else if(results[0].state === "emailsent" || results[0].state === "observed") {
            return callback(undefined,     "Check your email recently received in last five days from openblock.com and input verify code from email")
          } else {
            console.log("unexpected" + results[0].email)
          }
      }
      
    })
  },

 //  验证  0> 是否是合法用户,并且用户申请尚未过期 1> 是否已经提交验证码 
//   更新  设置 emailchecked 
  verifyReset: function(email, code, callback) {
    var colreset_auth = this.colreset_auth
    colreset_auth.find({email:email, code:code,  "$or":[{state:"emailsent"},{state:"observed"},{state:"emailchecked"}]}).toArray(function(err, results) {
      if (err) {
        return callback(err)
      }
      if (results.length == 0) {
        return callback(new Error("Verify code is invalid"))
      } else {
        if (results[0].state === "emailchecked") {
          //
          return callback(new Error("Already requested before"))
        }

        colreset_auth.update({email:email, code:code}, {$set:{state:"emailchecked"}}, function(err, docs) {
          if (err) {
            return callback(err)
          }
        })

        var rtime = results[0].reqtime
        var ntime = new Date()
        var alldays = results[0].waitdays
        var left =  alldays - Math.floor((ntime - rtime)/(1000*60*60*24))
       return callback(undefined ,  left+'') 
      }
    })
  }
  
};

module.exports = DB;
