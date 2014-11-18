
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
var async      = require('async')

var server     = express();

var StorageClass = require('./server/db/' + config.backends.uses);
var db = new StorageClass();
db.connect();

var listener = sockjs.createServer({log: function(severity, message) {}});
function ip_limit() {
  var iptables = {};
  var lastDeleteTime = Date.now();
  return function(ip) {
	if (Date.now() - lastDeleteTime >= 1000 * 60 *60) {
	  lastDeleteTime = Date.now();
	  iptables = {};
	  return true;
	}

	if (iptables[ip] == undefined) {
	  iptables[ip] = {'time':Date.now(),'count':0};
	  return true;
	} else {
	  if (Date.now() - iptables[ip]['time']>60000) {
		iptables[ip]['time'] = Date.now();
		iptables[ip]['count'] = 0;

		return true;
	  } else if(iptables[ip]['count'] < 20){
		iptables[ip]['count'] ++ ;
		return true;
	  } else {
		return false;
	  }
	}
  }
}

function getClientIp(req) {  
  return req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;
};  
var checkIPLimit = ip_limit();


function randomUrlWithWeight() {
  var urlsWithWeight = config.blockQueryServer;
  var urls = [];
  var weights = [];
  
  for (var i = 0; i< urlsWithWeight.length; i++) {
	for (var key in urlsWithWeight[i]) {
	  urls.push(key);
	  weights.push(urlsWithWeight[i][key]);
	}
  }
  if (urls.length !== weights.length) {
	return urls[0];
  }
  
  var total = 0;
  var scale = {}; //[0,total]
  for (var i=0; i<weights.length; i++) {
	var scaleStart = total;
	total += weights[i];
	scale[i] = [scaleStart, total];
  }
  var r = Math.random() * (total);
  for (var key in scale) {
	if (scale[key][0] <= r && scale[key][1] >r) {
      console.log("block query use server : " + urls[key]);
	  return urls[key];
	}
  }
  return urls[0];
}

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

server.post('/wallet/api/cpAuthKey', function(req,res) {
  var srcAuthKey;
  var dstAuthKey;
  if (req.body.srcSvrKey === req.body.dstSvrKey) {
	res.send({err: 'equal'});
  }
  db.getWalletRecord(req.body.srcSvrKey, function(err, origPayload) {
	if(err) {
	  console.error('Database error: ', err);	return res.send(errorResponse('There was a server error, please try again later.'));
	}
	if(origPayload && origPayload.authKey) {
	  srcAuthKey = origPayload.authKey;
	}
	if (srcAuthKey) {
	  db.setAuthKey(req.body.dstSvrKey, srcAuthKey, function(err, success) {
		if(err) {
		  console.error('SET AUTH KEY', err);
		  return res.send({set: false});
		}
		res.send({set: true});
	  });
	}  else {
	  res.send({err: 'nosrc'});
	}
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
  var broadcastFlag = false;
  var bqServe = "";
  var paraFunc = [];
  if (/sendtx/.test(req.url)) {
	res.send({success: 'blockQueryAll'});
	broadcastFlag = true;
	var servConfig = (config.blockQueryServer);
	var getHref = function(x) {
	  return function() {
		var rpcRequest = request.get(x);
		rpcRequest.on('error', function(err) {
		  console.error('Error on getting',req.params[0], err);
		});
	  }
	}

	for (var i=0; i<servConfig.length; i++) {
	  for(var urlkey in servConfig[i]) {
		var href = urlkey + '/queryapi/v1/' + req.params[0] + '?' + qs.stringify(req.query);
		paraFunc.push(getHref(href));
	  }
	}
  }else {
	bqServe = randomUrlWithWeight();
  }
  
  if (broadcastFlag) {
	async.parallel(paraFunc, function()	{});
  } else {
	var href = bqServe + '/queryapi/v1/' + req.params[0] + '?' + qs.stringify(req.query);
	var rpcRequest = request.get(href);
	rpcRequest.on('error', function(err) {
	  console.error('Error on getting', req.params[0], err);
	});
	rpcRequest.pipe(res);
  }
});

server.post(/wallet\/api\/infoproxy\/(.+)/, function(req, res){
  var broadcastFlag = false;
  var bqServ = "";
  var paraFunc = [];
  if (/sendtx/.test(req.url)) {
	res.send({success:"bolckQueryAll"});
	broadcastFlag = true;
	var servConfig = (config.blockQueryServer);
	var getHref = function(x) {
	  return function() {
		var rpcRequest = request({url:x, method:'POST', json:req.body, timeout:10000});
		rpcRequest.on('error', function(err) {
		  console.error('Error on posting', method, err, x);
		});
		//		  rpcRequest.pipe(res);
	  }
	}
	var method = req.params[0];
	for (var i=0; i<servConfig.length; i++) {
	  for(var urlkey in servConfig[i]) {
		var href = urlkey  + '/queryapi/v1/' + method;
		paraFunc.push(getHref(href));
	  }
	}
  } else {
	bqServ = randomUrlWithWeight()
  }
  
  if (broadcastFlag) {
	async.parallel(paraFunc,function(){});
  } else {
	var method = req.params[0];
	var href = bqServ + '/queryapi/v1/' + method;
	var rpcRequest = request({url:href, method:'POST', json:req.body, timeout:10000});
	rpcRequest.on('error', function(err) {
	  console.error('Error on posting', method, err, href);
	});
	console.log("post" + href + ":" +req.body.addresses);
    console.log(req.body)
	rpcRequest.pipe(res);
  }
});

server.get('/wallet/api/wallet',  function(req,res) {
  var ip;
  if (checkIPLimit) {
	ip = getClientIp(req);
  }
  
  if (checkIPLimit(ip) == false) {
	res.send({result: 'error', message: 'too many visitings'});
	console.log("too mutch ip visit" + ip);
	return ;
  }
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
  var ip;
  if (checkIPLimit) {
	ip = getClientIp(req);
  }
  
  if (checkIPLimit(ip) == false) {
	res.send({result: 'error', message: 'too many visitings'});
	console.log("this ip has too many  visits:" + ip);
	return ;
  }
  db.getWalletRecord(req.body.serverKey, function(err, origPayload) {
	if(err) {
	  console.error('Database error: ', err);	return res.send(errorResponse('There was a server error, please try again later.'));
	}
	var wallet = origPayload? origPayload.wallet:null;

	//cant override
	if(!req.body.override) {
	  if(wallet) {
		return res.send({result: 'exists', wallet: wallet});
	  }
	  
	  if(req.body.payload.email != undefined) {
		
		db.checkEmailExists(req.body.payload.email, function(err, response) {
		  if(response == true) {
			return res.send(errorResponse(['Email address already exists']));
		  } else if(config.mailer.enabled) {
			var args = {};
			if(!req.body.payload.emailActiveCode) {
              console.log("send register----");
			  var authCode = generateAuthCode(req.body.payload.email);
			  if (req.body.payload.action == "register") {
				var link = req.protocol + '://' + req.header('host') + '/wallet/#/signup/' + req.body.payload.email + '/' + authCode;
				var content = '<p>Hey, thank you for your registration, click the following link to continue:</p><p><a href="' + link + '">' + link + '</a></p><p>If the link cannot be clicked,  copy it into your browser to have another try.</p><p>(This email is automatically generated, please do not reply)'
				var sub = "Activate from openblock.com";
				if (req.body.payload.lang == "zh-cn") {
   				  content = '<p>你好:</p><p>感谢您注册OpenBlock,请点击下面的链接完成注册:</p><p><a href="' + link +'">' + link + '</a></p><p>如果以上链接无法点击,请将上面的地址复制到你的浏览器的地址栏进入注册页面</p><p>(这是一封自动产生的邮件,请勿回复)</p>';
				  sub = "OpenBlock账号激活";
				}
				args = {
				  from: config.mailer.fromAddress,
				  to: req.body.payload.email,
				  subject: sub,
				  html: content,
				};
			  } else {
				args = {
				  from: config.mailer.fromAddress,
				  to: req.body.payload.email,
				  subject: 'Activate code from openblock.com',
				  text: 'Your activate code from openblock.com is ' + authCode,
				};
			  }
			  
			  smtp.sendMail(args, function(err, mailRes) {
                if (err!=undefined) {
                  console.log(err)
                } else {
                  res.send({result: 'success'});
                  console.log("success send")
                }
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
	  // can override
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

server.get('/wallet/api/addlist', function(req, res) {
  var email = req.query.email;
  if ((/\w+?@\w+?\.\w{1,5}/).test(email) == false) {
	res.send({error:'invaliad email'});
	return;
  }
  db.getEmailAddresses(email, function(err, results){
	if (err) {
	  res.send({error:err});
	} else {
	  res.send({result:results});
	}
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
