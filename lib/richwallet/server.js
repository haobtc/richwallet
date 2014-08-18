var crypto     = require('crypto');
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
server.use(express.cookieParser(config.authCodeSalt || "richwallet secret"));
server.use('/wallet/', express.static('public'));
server.use(function(err, req, res, next){
  console.error(err.stack);
  res.send({error: true});
});

server.get('/', function(req, res) {
    res.redirect('/wallet/');
});

server.get('/wallet/api/generateAuthKey', function(req, res) {
  var keys = speakeasy.generate_key({length: 20});
  res.send({key: keys.base32});
});

server.post('/wallet/api/setAuthKey', function(req, res) {
  var code = speakeasy.time({key: req.body.key, encoding: 'base32'});

  if(code != req.body.code) {
      console.error('SET AUTH KEY false, code mismatch', req.body, 'code', code);
    return res.send({set: false});
  }

  db.setAuthKey(req.body.serverKey, req.body.key, function(err, success) {
    if(err) {
	console.error('SET AUTH KEY', err);
      return res.send({set: false});
    }
    res.send({set: true});
  });
});

server.post('/wallet/api/disableAuthKey', function(req, res) {
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

function backupToEmail(serverKey, mailText, callback){
  db.getWalletRecord(serverKey, function(err, payload) {
    if(err){
      console.error('Wallet Get Error:', err);
      if(typeof callback == 'function')
	callback(err);
      return;
    }
    var args = {
      from: config.mailer.fromAddress,
      to: payload.email,
      subject: 'Your backup wallet data',
      text: mailText,
      attachments: [{
	fileName: 'richwallet-wallet.txt',
	contents: payload.wallet
      }],
    };
    smtp.sendMail(args, function(err, mailRes) {
      console.log('email sent', err, mailRes);
      if(typeof callback == 'function')
	callback();
    });
  });
}


server.post('/wallet/api/backupToEmail', function(req, res) {
  backupToEmail(req.body.serverKey, 'You have requested to your save encrypted wallet at ' + new Date() + ' to your email, please save this email carefully so that your wallet can be recovered on some failure.', function(err){
    if(err)
      res.send({error: err});
    else
      res.send({result: 'success'});
  });
});

server.post('/wallet/api/emailAuth', function(req, res) {
    rq.body.email
});

server.get(/wallet\/api\/infoproxy\/(.+)/, function(req, res){
  var href = config.blockQueryServer + '/queryapi/v1/' + req.params[0] + '?' + qs.stringify(req.query);
  var rpcRequest = request.get(href);
  rpcRequest.on('error', function(err) {
    console.error('Error on getting', req.params[0], err);
  });
  rpcRequest.pipe(res);
});

server.post(/wallet\/api\/infoproxy\/(.+)/, function(req, res){
  var method = req.params[0];
  var href = config.blockQueryServer + '/queryapi/v1/' + method;
  var rpcRequest = request({url:href, method:'POST', json:req.body, timeout:10000});
  rpcRequest.on('error', function(err) {
    console.error('Error on posting', method, err);
  });
  rpcRequest.pipe(res);
});

server.get('/wallet/api/wallet', function(req,res) {
  db.getWalletRecord(req.query.serverKey, function(err, payload) {
    if(err) {
      console.log('Wallet Get Error: '+err);
      return res.send({result: 'error', message: 'Error retreiving wallet'});
    }

    if(!payload || !payload.wallet)
      return res.send({result: 'error', message: 'Wallet not found or invalid password'});
    if(!(req.signedCookies.authCode &&
	 req.signedCookies.authCode.user == payload.email &&
	 req.signedCookies.authCode.time > Date.now())){

      if(typeof req.query.authCode == 'undefined' && payload.authKey)
	return res.send({result: 'authCodeNeeded', message: 'Two factor authentication code needed'});

      if(payload.authKey) {
	var code = speakeasy.time({key: payload.authKey, encoding: 'base32'});
	if(req.query.authCode != code)
          return res.send({result: 'error', message: 'Two factor authentication code was invalid'});
	res.cookie('authCode', {user: payload.email, time: Date.now() + 7200000}, {maxAge: 7200000, signed: true});
      }
    }

    var usingAuthKey = false;
    if(payload.authKey){
      usingAuthKey = true;
    }

    return res.send({wallet: payload.wallet, usingAuthKey: usingAuthKey});
  });
});

server.post('/wallet/api/wallet/delete', function(req, res) {
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
      if(req.body.backup && config.mailer.enabled)
	backupToEmail(req.body.serverKey, 'Your encrypted wallet is saved automatically at ' + new Date() + ', please save this email carefully so that your wallet can be recovered on some failure.');
      res.send({result: 'ok'});
    }
  });
};

function errorResponse(errors) {
  if(typeof errors == 'string')
    errors = [errors];
  return {'result': 'error', messages: errors};
}

function generateAuthCode(email) {
    var checksum = crypto.createHash('sha1');
    checksum.update(config.authCodeSalt + '.' + email);
    return checksum.digest('hex');
}

server.post('/wallet/api/wallet', function(req,res) {
    db.getWalletRecord(req.body.serverKey, function(err, origPayload) {
      if(err) {
	console.error('Database error: ', err);	return res.send(errorResponse('There was a server error, please try again later.'));
      }
      var wallet = origPayload? origPayload.wallet:null;
      // New wallet
      if(!req.body.override) {
	if(wallet) {
	  return res.send({result: 'exists', wallet: wallet});
	}
	
	if(req.body.payload.email != undefined) {
	  db.checkEmailExists(req.body.payload.email, function(err, response) {
	    if(response == true) {
	      return res.send(errorResponse(['Email address already exists']));
	    } else if(config.mailer.enabled) {
	      if(!req.body.payload.emailActiveCode) {
		//
		var authCode = generateAuthCode(req.body.payload.email);
		var args = {
		  from: config.mailer.fromAddress,
		  to: req.body.payload.email,
		  subject: 'Activate code from openblock.com',
		  text: 'Your activate code from openblock.com is ' + authCode,
		};
		smtp.sendMail(args, function(err, mailRes) {
		  console.log('email sent to', req.body.payload.email, err, mailRes);
		  res.send({result: 'success'});
		});
		return res.send({result: 'requireAuthCode'});
	      } else if(req.body.payload.emailActiveCode !=
			generateAuthCode(req.body.payload.email)) {
		return res.send(errorResponse('Invalid email auth code.'));
	      } else {
		delete req.body.payload.emailActiveCode;
		return saveWallet(req, res);
	      }
	    } else {
	      delete req.body.payload.emailActiveCode;
	      return saveWallet(req, res);
	    }
	  });
	}
      } else {
	if(origPayload && origPayload.authKey && !req.body.payload.authKey) {
	  req.body.payload.authKey = origPayload.authKey;
	}
	return saveWallet(req, res);
      }
    });
});

server.get('/wallet/api/checkGoogleAuthCode', function(req, res){
  if(!(req.signedCookies.authCode &&
       req.signedCookies.authCode.user == req.query.email &&
       req.signedCookies.authCode.time > Date.now())){
    db.checkGoogleAuthCode(req.query.email, function(err, result){
      if(err) {
	res.send({error:err});
      } else{
	res.send({result:result});
      }
    });
  }
  else{
    res.send({result:'NotExpired'})
  }
});

server.get('/wallet/api/config', function(req, res) {
  res.send({
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
