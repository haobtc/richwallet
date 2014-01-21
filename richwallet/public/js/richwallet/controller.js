richwallet.Controller = function() {
};

richwallet.Controller.prototype.getUnspent = function(confirmations, callback) {
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

richwallet.Controller.prototype.mergeUnspent = function(unspent, callback) {
  if(richwallet.wallet.mergeUnspent(unspent) == true)
    this.saveWallet({override: true}, callback);
  else
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

      if(callback)
        callback(response);
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

richwallet.Controller.prototype.updateExchangeRates = function(id) {
  richwallet.pricing.getLatest(function(price, currency) {
    $('#balanceExchange').text(' ≈ '+ parseFloat(price * $('#balance').text()).toFixed(2) + ' ' + currency);
    $('#exchangePrice').text('1 BTC ≈ ' + price + ' ' + currency);

    $('#'+id+' .exchangePrice').remove();

    var prices = $('#'+id+' .addExchangePrice');
    for(var i=0;i<prices.length;i++) {
      $(prices[i]).append('<span class="exchangePrice"><small>'+($(prices[i]).text().trim().split(' ')[0] * price).toFixed(2)+' ' +currency+'</small></span>');
    }
  });
};

richwallet.Controller.prototype.minimumSendConfirmations = 1;
richwallet.Controller.prototype.minimumStrongSendConfirmations = 6;

richwallet.controllers = {};
