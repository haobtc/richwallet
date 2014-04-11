richwallet.Controller = function() {
};


richwallet.Controller.prototype.getUnspentServer = function(confirmations, callback) {
  var self = this;
  var query = {addresses: richwallet.wallet.addressHashes()};

  if(typeof(confirmations) == 'function')
    callback = confirmations;
  else
    query['confirmations'] = confirmations;

  $.post('/api/tx/unspent', query, function(resp) {
    if(resp.error) {
      richwallet.router.route('node_error');
      return;
    }
    self.mergeUnspent(resp.unspent, callback);
  });
};

richwallet.Controller.prototype.getUnspent = function(confirmations, callback) {
  var self = this;
  var query = {addresses: richwallet.wallet.addressHashes()};
  if(!query.addresses || query.addresses.length == 0) {
	return;
   }

  if(typeof(confirmations) == 'function')
    callback = confirmations;
  else
    query['confirmations'] = confirmations;

  // FIXME: handle query['confirmations']
  var jsonpUrl = '/api/infoproxy/unspent';
  $.getJSON(jsonpUrl, {addresses:query.addresses.join(',')}, function(resp) {
      for(var i=0; i<resp.length; i++) {
	  resp[i].hash = resp[i].txid;
      }
      self.mergeUnspent(resp, callback);
  });
};

richwallet.Controller.prototype.getTxDetails = function(txHashes, callback) {
    var txSections = {};
    for(var i=0; i<txHashes.length; i++) {
	var txHash = txHashes[i];
	var arr = txSections[txHash.network];
	if(arr) {
	    arr.push(txHash.tx);
	} else {
	    arr = [txHash.tx];
	    txSections[txHash.network] = arr;
	}
    }
    var jsonpUrl = '/api/infoproxy/tx/details';
    var query = {};
     for(var network in txSections) {
	 query[network] =  txSections[network].join(',');
    }

    $.getJSON(jsonpUrl, query, function(resp) {
	for(var i=0; i<resp.length; i++) {
	  resp[i].hash = resp[i].txid;
	}
	callback(resp);
    });
};


/*richwallet.Controller.prototype.getUnspent = function(confirmations, callback) {
  var self = this;
  var networkAddrs = richwallet.utils.clusterAddresses(richwallet.wallet.addressHashes());

  if(typeof(confirmations) == 'function')
    callback = confirmations;

  for(var network in networkAddrs) {
      var addrList = networkAddrs[network];
      networkAddrs[network] = [0, 99999999999999, addrList];
  }
  richwallet.utils.broadcastRPC('listunspent', networkAddrs, function(resp) {
      var unspent = [];
      for(var network in resp) {
	  var r = resp[network];
	  var err = r[0];
	  var btcres = r[1];
	  if(err) {
	      richwallet.router.route('node_error');
	      return;
	  }
	  for(var i=0;i<btcres.length; i++) {
	      var addrObj = new Bitcoin.Address(btcres[i].address);
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
      }
      self.mergeUnspent(unspent, callback);
  });
}; */

richwallet.Controller.prototype.mergeUnspent = function(unspent, callback) {
  if(richwallet.wallet.mergeUnspent(unspent) == true)
    this.saveWallet({override: true}, callback);
  else if(typeof callback == 'function')
    callback();
};

richwallet.Controller.prototype.saveWallet = function(data, callback) {
  var self = this;
  var data = data || {};
  data.serverKey = richwallet.wallet.serverKey;

  if(!data.payload)
    data.payload = {};

  //if(!data.payload.email)
  //  data.payload.email = richwallet.wallet.walletId;

  if(!data.payload.wallet)
    data.payload.wallet = richwallet.wallet.encryptPayload();

  data.payload.originalPayloadHash = richwallet.wallet.payloadHash;
  data.payload.newPayloadHash = richwallet.wallet.newPayloadHash;

  $.ajax({
    type: 'POST',
    url: '/api/wallet',
    data: data,
    dataType: 'json',
    success: function(response) {
      if(response.result == 'outOfSync') {
        richwallet.wallet.mergePayload(response.wallet);
        return self.saveWallet({override: true}, callback);
      }

      richwallet.wallet.payloadHash = richwallet.wallet.newPayloadHash;

      if(callback) {
        callback(response);
      }
    }
  });
};

richwallet.Controller.prototype.deleteWallet = function(serverKey, callback) {
  $.ajax({
    type: 'POST',
    url: '/api/wallet/delete',
    data: {serverKey: serverKey},
    dataType: 'json',
    success: function(response) {
      if(callback)
        callback(response);
    }
  });
};

richwallet.Controller.prototype.render = function(path, data, callback) {
  this.template('header', 'header');
  this.template('view', path, data, callback);
};

richwallet.Controller.prototype.template = function(id, path, data, callback) {
  richwallet.Template.draw(id, path, data, callback);
};

richwallet.Controller.prototype.friendlyTimeString = function(timestamp) {
  var date = new Date(timestamp);
  return date.toLocaleString();
};

richwallet.Controller.prototype.minimumSendConfirmations = 1;
richwallet.Controller.prototype.minimumStrongSendConfirmations = 6;

richwallet.controllers = {};
