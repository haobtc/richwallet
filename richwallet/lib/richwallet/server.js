var express    = require('express');
var redis      = require('redis');
var mailer     = require('nodemailer');
var request    = require('request');
var config     = require('./server/config');
var rpcpool    = require('./server/rpcpool')
var RedisDB    = require('./server/db/redis');
var sockjs     = require('sockjs');
var http       = require('http');
var https      = require('https');
var fs         = require('fs');
var speakeasy  = require('speakeasy');

var server     = express();

var db = new RedisDB();
db.connect();

var listener = sockjs.createServer({log: function(severity, message) {}});

function listUnspent(addresses, callback) {
  if(!addresses || addresses.length == 0) {
      callback(undefined, []);
      return;
  }
  rpcpool.eachNetwork(function(network, emit){
      var rpcServer = rpcpool.rpcServer(network);
      var networkAddresses = rpcpool.addressesByNetwork(addresses, network);
      rpcServer.rpc('listunspent', [0, 99999999999999, networkAddresses], function(err, btcres) {
	  if(err) {
	      emit({error: err, data: btcres});
	      return;
	  }

	  var unspent = [];

	  for(var i=0;i<btcres.length; i++) {
	      unspent.push({
		  network:       network,
		  hash:          btcres[i].txid,
		  vout:          btcres[i].vout,
		  address:       btcres[i].address,
		  scriptPubKey:  btcres[i].scriptPubKey,
		  amount:        btcres[i].amount,
		  confirmations: btcres[i].confirmations
	      });
	  }
	  emit({error: null, data: btcres});
      });
  }, function(r) {
      if(r.error) {
	  console.error(error);
	  return;
      }

      if(!this.unspent) {
	  this.unspent = r.data;
      } else {
	  for(var i=0; i<r.data.length; i++) {
	      this.unspent.push(r.data[i]);
	  }
      }
  }, function(res) {
      callback(undefined, res.unspent);
  });
};

listener.on('connection', function(conn) {
    conn.on('data', function(message) {
      var req = JSON.parse(message);
      if(req.method == 'listUnspent') {
        listUnspent(req.addresses, function(err, unspent) {
          if(err)
            conn.write(JSON.stringify(err));
          else
            conn.write(JSON.stringify({method: 'listUnspent', result: unspent}));
        });
      }
    });
});

server.use(express.json());
server.use(express.urlencoded());
server.use(express.static('public'));
server.use(function(err, req, res, next){
  console.error(err.stack);
  res.send({error: true});
});

server.get('/api/generateAuthKey', function(req, res) {
  var keys = speakeasy.generate_key({length: 20});
  res.send({key: keys.base32});
});

server.post('/api/setAuthKey', function(req, res) {
  var code = speakeasy.time({key: req.body.key, encoding: 'base32'});

  if(code != req.body.code)
    return res.send({set: false});

  db.setAuthKey(req.body.serverKey, req.body.key, function(err, success) {
    if(err)
      return res.send({set: false});
    res.send({set: true});
  });
});

server.post('/api/disableAuthKey', function(req, res) {
  db.getWalletRecord(req.body.serverKey, function(err, payload) {
    if(err)
      console.log('Wallet Get Error: '+err);

    if(!payload || !payload.authKey)
      return res.send({result: 'error', message: 'no auth key found for this wallet'});

    var code = speakeasy.time({key: payload.authKey, encoding: 'base32'});

    if(code != req.body.authCode)
      return res.send({result: 'error', message: 'invalid auth code'});

    db.disableAuthKey(req.body.serverKey, function(err, result) {
      if(err)
        return res.send({result: 'error', message: 'could not update database, please try again later'});
      res.send({result: 'success'});
    });
  });
});


var smtp = mailer.createTransport('SMTP', config.mailer.option);
server.post('/api/backupToEmail', function(req, res) {
  db.getWalletRecord(req.body.serverKey, function(err, payload) {
      if(err) {
	  console.error('Wallet Get Error:', err);
	  res.send({error: err});
	  return;
      }
      var args = {
	  from: config.mailer.fromAddress,
	  to: payload.email,
	  subject: 'Your backup richwallet wallet',
	  text: 'You have requested to your save encrypted wallet at ' + new Date() + ' to your email, please save this email carefully so that your wallet can be recovered on some failure.',
	  attachments: [{
	      fileName: 'richwallet-wallet.txt',
	      contents: payload.wallet
	  }],
      };
      smtp.sendMail(args, function(err, mailRes) {
	  console.log('email sent', err, mailRes);
	  res.send({result: 'success'});
      });
  });
});

var proxyWhiteList = {"sendrawtransaction": true};
server.post('/api/proxy/:network/:command', function(req, res) {
    if(!proxyWhiteList[req.params.command]) {
	res.send(["rpc not allowed", null]);
	return;
    }
    var rpcServer = rpcpool.rpcServer(req.params.network);
    rpcServer.rpc(req.params.command, req.body.args, function(err, btcres) {
      console.info('rpc', req.params.network, req.params.command,  req.body.args);
      res.send([err, btcres]);
    });
});


function callRPC(network, command, args, callback) {
    var rpcServer = rpcpool.rpcServer(network);
    rpcServer.rpc(command, args, function(err, btcres) {
	console.info('rpc', network, command,  args);
	callback(network, err, btcres);
    });
}

server.post('/api/bproxy/:command', function(req, res) {
    var reducer = [];
    for(var network in config.networks) {
	reducer.push(network);
    }
    
    var resObj = {};
    for(var network in config.networks) {
	var args = req.body.args[network] || [];
	callRPC(network, req.params.command, args, function(network, err, rpcres) {
	    resObj[network] = [err, rpcres];
	    reducer.pop();
	    if(reducer.length <= 0) {
		res.send(resObj);
	    }
	});
    }
});

server.get('/api/wallet', function(req,res) {
  db.getWalletRecord(req.query.serverKey, function(err, payload) {
    if(err) {
      console.log('Wallet Get Error: '+err);
      return res.send({result: 'error', message: 'Error retreiving wallet'});
    }

    if(!payload || !payload.wallet)
      return res.send({result: 'error', message: 'Wallet not found'});

    if(typeof req.query.authCode == 'undefined' && payload.authKey)
      return res.send({result: 'authCodeNeeded', message: 'Two factor authentication code needed'});

    if(payload.authKey) {
      var code = speakeasy.time({key: payload.authKey, encoding: 'base32'});
      if(req.query.authCode != code)
        return res.send({result: 'error', message: 'Two factor authentication code was invalid'});
    }

    return res.send({wallet: payload.wallet});
  });
});

server.post('/api/wallet/delete', function(req, res) {
  db.delete(req.body.serverKey, function(err, deleted) {
    if(deleted == true)
      res.send({result: 'success'});
    else
      res.send({result: 'notfound'});
  });
});

function saveWallet(req, res) {
  db.set(req.body.serverKey, req.body.payload, function(err, data) {
    if(err) {
      if(err == 'outOfSync') {
        return res.send({result: 'outOfSync', wallet: data.wallet});
      } else {
        return res.send(errorMessage("Database error: "+JSON.stringify(err)));
      }
    } else {
      res.send({result: 'ok'});
    }
  });
};

function saveWalletAndAddresses(req, res) {
  if(req.body.address) {
    var rpcServer = rpcpool.rpcServerByAddress(req.body.address);
    rpcServer.rpc('importaddress', [req.body.address, req.body.serverKey, false], function(err, btcres) {
      if(err)
        return res.send({messages: [err.message]});
      saveWallet(req, res);
    });
  } else if(req.body.importAddresses) {
    var batch = [];
    var cluster = rpcpool.clusterAddresses(req.body.importAddresses);
    cluster.forEach(function(r) {
	var rpcServer = rpcpool.rpcServer(r.network);
	var batch = [];
	//for(var i=0;i<r.addresses.length;i++) {
	r.addresses.forEach(function(addr, i) {
	    batch.push({method: 'importaddress', params: [addr, req.body.serverKey, true], id: i});
	});
	rpcServer.batch(batch, function(err, btcres){});
    });
/*    for(var i=0;i<req.body.importAddresses.length;i++) {
	var addr = req.body.importAddresses[i];
	var rpcServer = rpcpool.rpcServerByAddress(addr);
	rpcServer.push({method: 'importaddress', params: [addr, req.body.serverKey, true], id: i});
    }

    // Doing async now because bitcoind takes a while to scan the tx for existing addresses
    rpcServer.batch(batch, function(err, btcres) {});
*/
    saveWallet(req, res);
  } else {
    saveWallet(req, res);
  }
}

function errorResponse(errors) {
  if(typeof errors == 'string')
    errors = [errors];
  return {messages: errors};
}

server.post('/api/wallet', function(req,res) {
  db.getWallet(req.body.serverKey, function(err, wallet) {
    if(err) {
      console.log('Database error: '+err);
      return res.send(errorResponse('There was a server error, please try again later.'));
    }

    // New wallet
    if(!req.body.override) {
      if(wallet)
        return res.send({result: 'exists', wallet: wallet});

      if(req.body.payload.email != undefined)
        db.checkEmailExists(req.body.payload.email, function(err, response) {
          if(response == true)
            return res.send({result: 'error', messages: ['Email address already exists']});
          else
            return saveWalletAndAddresses(req, res);
        });
    }

    return saveWalletAndAddresses(req, res);
  });
});

server.get('/api/config', function(req, res) {
    var nwConf = {};
    for(var network in config.networks) {
	var conf = config.networks[network];
	nwConf[network] = {
	    leadingChar: conf.leadingChar,
	    version: conf.version,
	    fee: conf.fee,
	    keyVersion: conf.keyVersion,
	    p2sh: conf.p2sh,
	    currency: conf.currency
	};
    }
    res.send({
	networkConfigs: nwConf,
	transactionFee: 0.00001
    });
});


server.get('/api/weighted_prices', function(req, res) {
  /*
    For testing offline:
    res.send([{code: 'USD', rate: 40.00}]);
    return;
  */
  try {
    request({uri: config.pricesUrl, method: 'GET'}, function (error, pricesResponse, body) {
      if (!error && pricesResponse.statusCode == 200) {
        res.send(JSON.parse(body));
      } else {
        res.send({error: 'cannot connect to the weighted prices API'});
      }
      return;
    });
  } catch(err)  {
    console.log(err);
    res.send({error: 'cannot connect to the weighted prices API'});
  }
});

server.post('/api/tx/unspent', function(req,res) {
  listUnspent(req.body.addresses, function(err, unspent) {
    if(err)
      return res.send({error: 'bitcoinNode'});

    res.send({unspent: unspent});
  });
});

server.post('/api/tx/details', function(req,res) {
    var i = 0;

    if(!req.body.txHashes) {
	res.send([]);
	return;
    }
    rpcpool.eachNetwork(function(network, emit) {
	var queries = [];
	for(i=0;i<req.body.txHashes.length;i++) {
	    var txObj = req.body.txHashes[i];
	    if(!txObj.network || txObj.network == network) {
		queries.push({method: 'gettransaction', params: [txObj.tx]});
	    }
	}
	if(queries.length == 0) {
	    emit([]);
	    return;
	}
	var rpcServer = rpcpool.rpcServer(network);
	rpcServer.batch(queries, function(err, results) {
	    if(err) console.log(err);

	    var txes = [];

	    for(var i=0; i<results.length;i++) {
		var result = results[i].result;
		if(result == null)
		    continue;

		txes.push({
                    network: network,
		    hash: result.txid,
		    time: result.time,
		    amount: result.amount,
		    fee: result.fee,
		    confirmations: result.confirmations,
		    blockhash: result.blockhash,
		    blockindex: result.blockindex,
		    blocktime: result.blocktime
		});
	    }
	    emit(txes);
	});
    }, function(txlist){
	if(!this.txes) {
	    this.txes = txlist;
	} else {
	    var self = this;
	    txlist.forEach(function(tx) {
		self.txes.push(tx);
	    });
	}      
    }, function(resobj) {
	res.send(resobj.txes);
    });
});

if(config.httpsPort || config.sslKey || config.sslCert) {
  var httpsServer = https.createServer({
    key: fs.readFileSync(config.sslKey, 'utf8'),
    cert: fs.readFileSync(config.sslCert, 'utf8')
  }, server);

  listener.installHandlers(httpsServer, {prefix:'/listener'});
  module.exports.httpsServer = httpsServer;

  module.exports.httpServer = http.createServer(function(req, res) {
    var host = req.headers.host;
    if(typeof host == "undefined")
      return res.end();
    res.statusCode = 302;
    var host = req.headers.host;
    var hostname = host.match(/:/g) ? host.slice(0, host.indexOf(":")) : host;
    res.setHeader('Location', 'https://'+hostname+':'+config.httpsPort+'/');
    res.end();
  });
} else {
  console.log('Warning: You are not running in SSL mode!');

  var httpServer = http.createServer(server);
  listener.installHandlers(httpServer, {prefix:'/listener'});
  module.exports.httpServer = httpServer;
}

module.exports.config = config;
module.exports.server = server;
