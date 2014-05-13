richwallet.Controller = function() {
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
  var jsonpUrl = 'api/infoproxy/unspent';
  $.post(jsonpUrl, {addresses:query.addresses.join(',')}, function(resp) {
      for(var i=0; i<resp.length; i++) {
	  resp[i].hash = resp[i].txid;
      }
      self.mergeUnspent(resp, callback);
  }, 'json');
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
    var jsonpUrl = 'api/infoproxy/tx/details';
    var query = {};
     for(var network in txSections) {
	 query[network] =  txSections[network].join(',');
    }

    $.post(jsonpUrl, query, function(resp) {
	for(var i=0; i<resp.length; i++) {
	  var tx = resp[i];
	  tx.hash = tx.txid;
	}
	callback(resp);
    }, 'json');
};

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

  if(!data.payload.email)
    data.payload.email = richwallet.wallet.walletId;

  if(!data.payload.wallet)
    data.payload.wallet = richwallet.wallet.encryptPayload();

  data.payload.originalPayloadHash = richwallet.wallet.payloadHash;
  data.payload.newPayloadHash = richwallet.wallet.newPayloadHash;

  $.ajax({
    type: 'POST',
    url: 'api/wallet',
    data: data,
    dataType: 'json',
    success: function(response) {
      if(response.result == 'outOfSync') {
	  alert(T("Wallet was changed elsewhere, reload required!"));
	  window.location.reload();
        //richwallet.wallet.mergePayload(response.wallet);
        //return self.saveWallet({override: true}, callback);
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
    url: 'api/wallet/delete',
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

richwallet.Controller.prototype.showSuccessMessage = function(text) {
    var msgDom = $('<div class="alert alert-success alert-dismissable" id="successMessage" style="margin-top: 20px;">' +
	'<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>' +
      '<span id="messageContent"></span></div>');
    $('#messageContent', msgDom).html(text);
    //$('#view').prepand(msgDom);
    msgDom.insertBefore($('#view'));
    setTimeout(function() {
	$('#successMessage').fadeOut(function() {
	    $(this).remove();
	});
    }, 5000);
};

richwallet.Controller.prototype.minimumSendConfirmations = 1;
richwallet.Controller.prototype.minimumStrongSendConfirmations = 6;

richwallet.controllers = {};
