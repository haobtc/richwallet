richwallet.controllers.Addresses = function() {};
richwallet.controllers.Addresses.prototype = new richwallet.Controller();

richwallet.controllers.Addresses.prototype.list = function() {
  var self = this;
  this.render('addresses/list', {addresses: richwallet.wallet.receiveAddresses()}, function(id) {
    self.updateExchangeRates(id);
  });
}

richwallet.controllers.Addresses.prototype.generateNewAddress = function(network, label) {
  var self = this;
  var label = label || '';
  network  = network || 'litecoin';
  var address = richwallet.wallet.createNewAddress(network, label, false);

  this.saveWallet({address: address, override: true}, function() {
    self.render('addresses/list', {addresses: richwallet.wallet.addresses()}, function(id) {
      self.updateExchangeRates(id, false);
    });
    $('#newAddressDialog').removeClass('hidden');
    var message = 'Created new address '+address;
    if(label != '')
      var message = message + ' with label '+label;
    $('#newAddressMessage').text(message+'.');
  });
};

richwallet.controllers.Addresses.prototype.request = function(address) {
  var self = this;
  this.render('addresses/request', {address: address}, function(id) {
    self.drawRequestQR(address);
  });
}

richwallet.controllers.Addresses.prototype.requestExchangeUpdate = function() {
  var amount = $('#amount').val();
  richwallet.pricing.getLatest(function(price, currency) {
    var newAmount = parseFloat(price * amount).toFixed(2);
    
    if(newAmount == "NaN")
      return;
    
    $('#amountExchange').val(newAmount);
  });
};

richwallet.controllers.Addresses.prototype.requestBTCUpdate = function() {
  var amountExchange = $('#amountExchange').val();
  richwallet.pricing.getLatest(function(price, currency) {
    
    if(amountExchange == 0)
      return;

    var newAmount = parseFloat(amountExchange / price).toFixed(6).replace(/0+$/, '');
    
    if(newAmount == "NaN")
      return;
    
    $('#amount').val(newAmount);
  });
};

richwallet.controllers.Addresses.prototype.drawRequestQR = function(address) {
  var uri = URI({protocol: 'bitcoin', path: address});
  
  var amount = $('#amount').val();
  var label = $('#label').val();
  var message = $('#message').val();

  if(amount && amount != '' && amount != '0.00')
    uri.addQuery('amount', amount);

  if(label && label != '')
    uri.addQuery('label', label);
    
  if(message && message != '')
    uri.addQuery('message', message);

  $('#qrcode').html('');
  new QRCode(document.getElementById('qrcode'), uri.toString().replace('://', ':'));
}

richwallet.controllers.addresses = new richwallet.controllers.Addresses();
