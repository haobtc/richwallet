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

  this.saveWallet(richwallet.wallet, {override: true, onOutOfSync:'reload', backup: true}, function() {
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

richwallet.controllers.Addresses.prototype.isZeroBalanceAddressesHidden = function(){
  return richwallet.localProfile.get("isZeroBalanceAddressesHidden");
}

richwallet.controllers.Addresses.prototype.toggleZeroBalanceAddressesHidden = function(hidden){
  richwallet.localProfile.set("isZeroBalanceAddressesHidden", hidden);
  if(hidden){
    $(".zero-balance").addClass("hidden");
    $(".zero-balance-show").removeClass("hidden");
    //$("#zero-balance-toggle").parent("div.switch").setStatus(true, true);
  }
  else{
    $(".zero-balance").removeClass("hidden");
    $(".zero-balance-show").addClass("hidden");
    //$("#zero-balance-toggle").parent("div.switch").setStatus(false, true);
  }
}

richwallet.controllers.Addresses.prototype.editLabel = function(address){
  var self = this;
  var name = richwallet.wallet.getAddressName(address);
  var dialog = $("#editLabel");
  dialog.find("input[name=addressName]").val(name || "");
  var bConfirm = false;
  dialog.find("form").off("submit").on("submit", function(){
    bConfirm = true;
    name = dialog.find("input[name=addressName]").val();
    dialog.modal('hide');
    return false;
  });
  dialog.off("hidden.bs.modal").on("hidden.bs.modal", function(){
    if(bConfirm){
      richwallet.wallet.setAddressName(address, name);
      self.saveWallet(richwallet.wallet, {override: true, backup: true}, function(){});
      $("div[data-address=" + address + "] strong:first").text(name || T('No Label'));
      $("tr[data-address=" + address + "] td:first").text(name || T('No Label'));
    }
  });
  dialog.off("shown.bs.modal").on("shown.bs.modal", function(){
    dialog.find("input[name=addressName]").focus(function(){this.select();}).focus();
  });
  dialog.modal({"backdrop":false});
}



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
