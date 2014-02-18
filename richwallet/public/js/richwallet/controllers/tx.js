richwallet.controllers.Tx = function() {};
richwallet.controllers.Tx.prototype = new richwallet.Controller();

richwallet.controllers.Tx.prototype.defaultFee = '0.0001';
richwallet.controllers.Tx.prototype.minimumConfirmationsToSpend = 1;

richwallet.controllers.Tx.prototype.details = function(txHash, network) {
  var self = this;
  var reqObj = {tx:txHash};
  if(network) {
      reqObj.network = network;
  }
  $.post('/api/tx/details', {txHashes: [reqObj]}, function(resp) {
    var tx = resp[0];
    var currency = richwallet.config.networkConfigs[tx.network].currency;
    self.render('tx/details', {tx: tx, currency: currency}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
    });
  });
};

richwallet.controllers.Tx.prototype.send = function() {
  var self = this;

  this.getUnspent(function(resp) {
    var balances = {};
    for(var network in richwallet.config.networkConfigs) {
	var b = richwallet.wallet.safeUnspentBalance(network);
	balances[network] = b;
    }
    richwallet.router.render('view', 'tx/send', {balances:balances}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
    });
  });
};

richwallet.controllers.Tx.prototype.create = function() {
  var self = this;
  var sendButton = $('#sendButton');
  sendButton.addClass('disabled');
  var address = $('#createSendForm #address').val();
  var amount = $('#createSendForm #amount').val();
  var errors = [];
  var errorsDiv = $('#errors');
  var toAddress;
  
  this.calculateFee();
  var calculatedFee = $('#calculatedFee').val();
    
  errorsDiv.addClass('hidden');
  errorsDiv.html('');

  if(address == '')
    errors.push('You cannot have a blank sending address.');
  else {
    try {
      toAddress = new Bitcoin.Address(address);
    } catch (e) {
	console.error('addr', address, e);
      errors.push('The provided bitcoin address is not valid.');
    }
  }

  var myAddresses = richwallet.wallet.addresses(toAddress.getNetwork());
  
  for(var i=0; i<myAddresses.length;i++) {
    if(myAddresses[i].address == address)
      errors.push('You cannot send to your own bitcoin wallet.');
  }

  if(amount == '' || parseFloat(amount) == 0)
    errors.push('You must have a valid amount to send.');
  else if(/^[0-9]+$|^[0-9]+\.[0-9]+$|^\.[0-9]+$/.exec(amount) === null)
    errors.push('You must have a valid amount to send.');
  else if(richwallet.wallet.safeUnspentBalance(toAddress.getNetwork()).lessThan(new BigNumber(amount).plus(calculatedFee))) {
    errors.push('Cannot spend more bitcoins than you currently have.');
  }

  if(errors.length > 0) {
    this.displayErrors(errors, errorsDiv);
    sendButton.removeClass('disabled');
    return;
  }

  var changeAddress = $('#changeAddress').val();

  if(changeAddress == '')
    changeAddress = richwallet.wallet.createNewAddress(toAddress.getNetwork(), 'change', true);

  var tx = richwallet.wallet.createTx(amount, calculatedFee, address, changeAddress);
  self.saveWallet({override: true, address: changeAddress}, function(response) {
      richwallet.utils.callRPC(
	  toAddress.getNetwork(), 
	  'sendrawtransaction', 
	  [tx.raw], 
	  function(err, btcres) {
	      if(err) {
		  console.error('send raw transaction error', err);
		  return;
	      }
	      richwallet.database.setSuccessMessage("Sent "+amount+" BTC to "+address+".");
	      richwallet.wallet.addTx(tx, amount, calculatedFee, address, changeAddress);
	      self.getUnspent(function() {
		  richwallet.router.route('dashboard');
	      });
	  });
  });
};

richwallet.controllers.Tx.prototype.displayErrors = function(errors, errorsDiv) {
  if(errors.length > 0) {
    errorsDiv.removeClass('hidden');
    
    for(var i=0; i<errors.length; i++) {
      $('#errors').html($('#errors').html()+richwallet.utils.stripTags(errors[i])+'<br>');
    }
    return;
  }
};

richwallet.controllers.Tx.prototype.calculateFee = function() {
  var address = $('#address').val();
  var amount = $('#amount').val();
  var sendAmount = $('#sendAmount');

  if(amount == sendAmount.val())
    return;
  else
    sendAmount.val(amount);

  if(address == '' || amount == '')
    return;

  var changeAddress = $('#changeAddress').val();
  var calculatedFee = $('#calculatedFee').val();

  var addrObj = new Bitcoin.Address(address);
  if(changeAddress == '') {
    changeAddress = richwallet.wallet.createNewAddress(addrObj.getNetwork(), 'change', true);
    $('#changeAddress').val(changeAddress);
  }

  var calculatedFee = richwallet.wallet.calculateFee(amount, address, changeAddress);
  $('#calculatedFee').val(calculatedFee);
  $('#fee').text(richwallet.wallet.calculateFee(amount, address, changeAddress)+' ' + addrObj.networkConfig().currency);
  $('#fee').parents('p').show();
};

richwallet.controllers.Tx.prototype.calculateUnspentBalance = function() {
    var network = '';
    var address = $('#address').val();
    try{
	var addr = new Bitcoin.Address(address);
	network = addr.getNetwork();
    }catch(e) {
	network = '';
    }
    if(network) {
	var balance = richwallet.wallet.safeUnspentBalance(network);
	var currency = richwallet.config.networkConfigs[network].currency;
	$('#availableBalance').html('' + balance + ' ' + currency);
	$('#availableBalance').parents('.row').show();
    } else {
	$('#availableBalance').html('');
	$('#availableBalance').parents('.row').hide();
    }
};

richwallet.controllers.Tx.prototype.scanQR = function(event) {
  var errorsDiv = $('#errors');
  var self = this;

  errorsDiv.addClass('hidden');
  errorsDiv.html('');

  if(event.target.files.length != 1 && event.target.files[0].type.indexOf("image/") != 0)
    return this.displayErrors(['You must provide only one image file.'], errorsDiv);

  qrcode.callback = function(result) {
    if(result === 'error decoding QR Code')
      return errorsDiv.removeClass('hidden').text('Could not process the QR code, the image may be blurry. Please try again.');

    var uri = new URI(result);

    if(uri.protocol() != 'bitcoin')
      return errorsDiv.removeClass('hidden').text('Not a valid Bitcoin QR code.');
    
    var address = uri.path();
    if(!address || address == '')
      return errorsDiv.removeClass('hidden').text('No Bitcoin address found in QR code.');

    $('#address').val(address);
    
    var queryHash = uri.search(true);
    
    if(queryHash.amount)
      $('#amount').val(queryHash.amount);
  }

  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');

  var img = new Image();
  img.onload = function() {
    /*
    Helpful URLs: 
    http://hacks.mozilla.org/2011/01/how-to-develop-a-html5-image-uploader/
    http://stackoverflow.com/questions/19432269/ios-html5-canvas-drawimage-vertical-scaling-bug-even-for-small-images
  
    There are a lot of arbitrary things here. Help to clean this up welcome.
    
    context.save();
    context.scale(1e6, 1e6);
    context.drawImage(img, 0, 0, 1e-7, 1e-7, 0, 0, 1e-7, 1e-7);
    context.restore();
    */

    if((img.width == 2448 && img.height == 3264) || (img.width == 3264 && img.height == 2448)) {
      canvas.width = 1024;
      canvas.height = 1365;
      context.drawImage(img, 0, 0, 1024, 1365);
    } else if(img.width > 1024 || img.height > 1024) {
      canvas.width = img.width*0.15;
      canvas.height = img.height*0.15;
      context.drawImage(img, 0, 0, img.width*0.15, img.height*0.15);
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0, img.width, img.height);
    }

    qrcode.decode(canvas.toDataURL('image/png'));
  }

  img.src = URL.createObjectURL(event.target.files[0]);
};

richwallet.controllers.tx = new richwallet.controllers.Tx();
