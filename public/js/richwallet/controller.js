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
  var self = this;
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
      //var tx = resp[i];
      //tx.hash = tx.txid;
      //tx.details
      self.processTxDetail(resp[i]);
    }
    callback(resp);
  }, 'json');
};

richwallet.Controller.prototype.processTxDetail = function(txDetail) {
  var sumInput = new BigNumber(0);
  var sumOutput = new BigNumber(0);
  var sendAmount = new BigNumber(0);

  txDetail.type = 'receive';
  txDetail.hash = txDetail.txid;
  var selfAddrDict = {};
  _.map(richwallet.wallet.addressHashes(txDetail.network), function(addr) {
    selfAddrDict[addr] = true;
  });
  
  _.map(txDetail.inputs, function(input) {
    sumInput = sumInput.plus(input.amount);
    var addrs = input.address.split(',');
    for(var i=0; i<addrs.length; i++) {
      if(selfAddrDict[addrs[i]]) {
	txDetail.type = 'send';
	input.inWallet = true;
      }
    }
  });

  var selfAddrs = [];
  var extAddrs = [];
  _.map(txDetail.outputs, function(output) {
    sumOutput = sumOutput.plus(output.amount);
    var addrs = output.address.split(',');
    for(var i=0; i<addrs.length; i++) {
      if(!selfAddrDict[addrs[i]]) {
	sendAmount = sendAmount.plus(new BigNumber(output.amount).div(addrs.length));
	extAddrs.push(addrs[i]);
	output.inWallet = false;
      } else {
	selfAddrs.push(addrs[i]);
	output.inWallet = true;
      }
    }
  });

  if(txDetail.type == 'send') {
    txDetail.amount = sendAmount;
    txDetail.address = extAddrs;
  } else {
    txDetail.amount = sumOutput.minus(sendAmount);
    txDetail.address = selfAddrs;
  }
  txDetail.fee = sumInput.minus(sumOutput);
};

richwallet.Controller.prototype.mergeUnspent = function(unspent, callback) {
  var self = this;
  richwallet.wallet.mergeUnspent(unspent, function(changed) {
    if(changed) {
      self.saveWallet(richwallet.wallet, {override: true}, callback);
    } else if(typeof callback=='function'){
      callback();
    }
  });
};

richwallet.Controller.prototype.saveWallet = function(wallet, data, callback) {
  var self = this;
  var data = data || {};
  data.serverKey = wallet.serverKey;

  if(!data.payload)
    data.payload = {};

  if(!data.payload.email)
    data.payload.email = wallet.walletId;

  data.payload.wallet = wallet.encryptPayload();
  data.payload.addresses = wallet.addressHashes();
  data.payload.originalPayloadHash = wallet.payloadHash;
  data.payload.newPayloadHash = wallet.newPayloadHash;

  $.ajax({
    type: 'POST',
    url: 'api/wallet',
    data: data,
    dataType: 'json',
    success: function(response) {
      if(response.result == 'outOfSync') {
	if(data.onOutOfSync == 'reload') {
	   alert(T("Wallet was changed elsewhere, reload required!"));
          window.location.reload();
	} else {
          wallet.mergePayload(response.wallet);
          return self.saveWallet(wallet, {override: true}, callback);
	}
      }
      wallet.payloadHash = wallet.newPayloadHash;
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

richwallet.Controller.prototype.showErrorMessage = function(text) {
    var msgDom = $('<div class="alert alert-danger alert-dismissable" id="errorMessage" style="margin-top: 20px;">' +
	'<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>' +
      '<span id="messageContent"></span></div>');
    $('#messageContent', msgDom).html(text);
    //$('#view').prepand(msgDom);
    msgDom.insertBefore($('#view'));
    setTimeout(function() {
	$('#errorMessage').fadeOut(function() {
	    $(this).remove();
	});
    }, 5000);
};

richwallet.Controller.prototype.minimumSendConfirmations = 1;
richwallet.Controller.prototype.minimumStrongSendConfirmations = 6;

richwallet.controllers = {};
