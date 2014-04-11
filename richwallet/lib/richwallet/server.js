var qs         = require('querystring');
var express    = require('express');
var mailer     = require('nodemailer');
var request    = require('request');
var config     = require('./server/config');
var sockjs     = require('sockjs');
var http       = require('http');
var https      = require('https');
var fs         = require('fs');
var speakeasy  = require('speakeasy');

var server     = express();

var StorageClass = require('./server/db/' + config.backends.uses);
var db = new StorageClass();
db.connect();

var listener = sockjs.createServer({log: function(severity, message) {}});

listener.on('connection', function(conn) {
    conn.on('data', function(message) {
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

server.get(/api\/infoproxy\/(.+)/, function(req, res){
    var href = config.blockInfoServer + '/infoapi/v1/' + req.params[0] + '?' + qs.stringify(req.query);
    request.get(href).pipe(res);    
});

server.post(/api\/infoproxy\/(.+)/, function(req, res){
    var href = config.blockInfoServer + '/infoapi/v1/' + req.params[0];
    var rpcRequest = request({url:href, method:'POST', json:req.body, timeout:10000});
    rpcRequest.pipe(res);
});

server.post('/api/proxy/:network/:command', function(req, res) {
    var href = config.blockInfoServer + '/infoapi/v1/proxy/' + req.params.network;
    var payload = {jsonrpc: "2.0", method: req.params.command, params: req.body.args};
    request({url: href, method: 'POST', json:payload, timeout:10000}).pipe(res);
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
        return res.send({error: "Database error: "+JSON.stringify(err)});
      }
    } else {
      res.send({result: 'ok'});
    }
  });
};

function saveWalletAndAddresses(req, res) {
    saveWallet(req, res);
    return;
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
	emailEnabled: config.mailer.enabled
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
