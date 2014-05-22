richwallet.controllers.Addresses = function() {};
richwallet.controllers.Addresses.prototype = new richwallet.Controller();

richwallet.controllers.Addresses.prototype.list = function() {
  var self = this;
  this.render('addresses/list', {addresses: richwallet.wallet.addresses(),
				balances: richwallet.wallet.balanceForAddresses()}, function(id) {
  });
}

richwallet.controllers.Addresses.prototype.generateNewAddress = function(network, label) {
  var self = this;
  var label = label || '';
  network  = network || 'litecoin';
  var address = richwallet.wallet.createNewAddress(network, label, false);

  this.saveWallet(richwallet.wallet, {address: address, override: true, backup: true}, function() {
    self.render('addresses/list', {addresses: richwallet.wallet.addresses(),
				  balances: richwallet.wallet.balanceForAddresses()}, function(id) {
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
  var addr = new Bitcoin.Address(address);
  this.render('addresses/request', {address: address, network: addr.getNetwork()}, function(id) {
    self.drawRequestQR(address);
  });
}

richwallet.controllers.Addresses.prototype.drawRequestQR = function(address) {
  var addr = new Bitcoin.Address(address);
  var uri = URI({protocol: addr.getNetwork(), path: address});
  
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
  new QRCode(document.getElementById('qrcode'), {
      text: uri.toString().replace('://', ':'),
      correctLevel: QRCode.CorrectLevel.M
  });
}

richwallet.controllers.addresses = new richwallet.controllers.Addresses();
