var minAmount = new BigNumber('0.00000001');

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

  this.getTxDetails([reqObj], function(resp) {
    var tx = resp[0];
    var txs = richwallet.wallet.transactions;
    for(var i=0;i<txs.length;i++) {
	if(txs[i].network == tx.network && txs[i].hash == tx.hash) {
	    tx.amount = txs[i].amount;
	    if(!tx.fee) {
		tx.fee = txs[i].fee;
	    }
	    txs[i].confirmations = tx.confirmations;
	    break;
	}
    }

    var currency = richwallet.config.networkConfigs[tx.network].currency;
    self.render('tx/details', {tx: tx, currency: currency}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
    });
  });
};

richwallet.controllers.Tx.prototype.advsend = function(network, toaddress) {
  var self = this;
  toaddress = toaddress || '';
  this.getUnspent(function(resp) {
    var balance = richwallet.wallet.balanceObject()[network] || 0;
    richwallet.router.render(
	'view',
	'tx/advsend', 
	{network: network,
	 balance: balance,
	 toaddress:toaddress,
	 addresses: richwallet.wallet.addressHashes(network),
	 balance4Addresses: richwallet.wallet.balanceForAddresses(network)},
	function(id) {
	    $('#'+id+" [rel='tooltip']").tooltip();
	    if(toaddress) {
		$('#' + id + ' #address').change();
	    }
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

// Advanced send
richwallet.controllers.Tx.prototype.advAddSendTo = function() {
    var newRow = $('.sendtoRow:last').clone();
    $('input', newRow).val('');
    $('.outputAddress', newRow).addClass('col-lg-offset-4');
    newRow.insertAfter($('.sendtoRow:last'));
    $('#removeSendto').show();
};

richwallet.controllers.Tx.prototype.advRemoveSendTo = function() {
    if($('.sendtoRow').length > 1) {
	$('.sendtoRow:last').remove();
    }
    if($('.sendtoRow').length <= 1) {
	$('#removeSendto').hide();
    }
};

richwallet.controllers.Tx.prototype.advSelectAllAddresses = function() {
     $('#fromAddresses input[type=checkbox]').prop('checked', 'checked');
};


richwallet.controllers.Tx.prototype.advCheckValues = function() {
    var network = $('#sendBlock').attr('rel');
    var sumInputAmount = new BigNumber(0);
    var sumOutputAmount = new BigNumber(0);
    var enableButton = true;
    var errorMessages = [];


    $('#fromAddresses input:checked').each(function() {
	//var amount = parseFloat($(this).val());
	var amount = richwallet.utils.parseBigNumber($(this).val());
	sumInputAmount = sumInputAmount.plus(amount);
    });
    $('#totalBalance').html(sumInputAmount.toString());

    $('.sendtoRow input[name=address]').each(function() {
	var addressString = $(this).val();
	var hasError = false;
	if(addressString) {
	    try {
		var addr = new Bitcoin.Address(addressString);
		if(addr.getNetwork() != network) {
		    errorMessages.push('different network');
		    hasError = true;
		}
	    } catch(e) {
		errorMessages.push('illegal address');
		hasError = true;
	    }
	}
	if(hasError) {
	    $(this).parent().addClass('has-error');
	    enableButton = false;
	} else {
	    $(this).parent().removeClass('has-error');
	}
    });

    $('.sendtoRow input[name=amount]').each(function() {
	var amountString = $(this).val();
	var hasError = false;
	if(amountString) {
	    var amount = richwallet.utils.parseBigNumber(amountString);
	    if(isNaN(amount) || amount.comparedTo(minAmount) <= 0) {
		errorMessages.push('illegal amount');
		hasError = true;
	    }
	    if(sumOutputAmount.plus(amount).comparedTo(sumInputAmount) > 0) {
		errorMessages.push('input < output');
		hasError = true;
	    } else {
		sumOutputAmount = sumOutputAmount.plus(amount);
	    }	    
	} else {
	    enableButton = false;
	}
	if(hasError) {
	    console.error('error on sending', errorMessages);
	    $(this).parent().addClass('has-error');
	    if(enableButton) {
		enableButton = false;
	    }
	} else {
	    $(this).parent().removeClass('has-error');
	}
    });

    // Fee ratge
    var feeString = $('#calculatedFee').val();
    var hasError = false;
    if(feeString) {
	var fee = richwallet.utils.parseBigNumber(feeString);
	if(isNaN(fee) || fee.comparedTo(0) < 0 ||
	   sumOutputAmount.plus(fee).comparedTo(sumInputAmount) > 0) {
	    hasError = true;
	}
    } else {
	enableButton = false;
    }

    if(hasError) {
	$('#calculatedFee').parent().addClass('has-error');	
	enableButton = false;
    } else {
	$('#calculatedFee').parent().removeClass('has-error');
    }

    if(enableButton) {
	$('#sendButton').removeClass('disabled');
    } else {
	$('#sendButton').addClass('disabled');
    }
};

richwallet.controllers.Tx.prototype.showSendReview = function(txInfo, callback){
  $("#confirmSend h4").text(T("%s transaction review", T(txInfo.network)));
  var sendElement = $("#confirmSend ul");
  var sendtoItemElement = sendElement.find("li:first");
  sendElement.find("li:not(:last):not(:first)").remove();
  var totalSendAmount = new BigNumber(0);
  _.map(txInfo.outputs, function(sendto){
    var el = sendtoItemElement.clone().remove();
    el.find("span:first").text(sendto.address);
    el.find("span:last").text(sendto.amount + ' ' + richwallet.config.networkConfigs[txInfo.network].currency);
    sendElement.find("li:last").before(el);
    totalSendAmount = totalSendAmount.plus(sendto.amount);
  });
  if(txInfo.outputs.length){
    sendtoItemElement.remove();
  }
  sendElement.find("span[data-role=total]").text(totalSendAmount);
  sendElement.find("span[data-role=currency]").text(richwallet.config.networkConfigs[txInfo.network].currency);
  var feeElement = $("#confirmSend span[data-role='fee']").text(txInfo.fee + ' ' + richwallet.config.networkConfigs[txInfo.network].currency);
  feeElement.next().remove();
  if(txInfo.fee.comparedTo(richwallet.config.networkConfigs[txInfo.network].fee) < 0){
    feeElement.addClass("bg-danger");
    feeElement.after($("<span></span>").addClass("text-danger").text(T("Costs is not enough")).css({'margin-left':'30px'}));
  }
  else{
    feeElement.removeClass("bg-danger");
  }
  var bConfirm = false;
  $("#confirmSend button[type=submit]").off('click').on("click",function(){
    bConfirm = true;
    $("#confirmSend").modal('hide');
    return false;
  });
  $("#confirmSend").off("hidden.bs.modal").on("hidden.bs.modal",function(){
    callback(bConfirm);
  });
  $("#confirmSend").modal({backdrop:false});
};

richwallet.controllers.Tx.prototype.advCreate = function() {
    var inputAddresses = [];
    var outputs = [];

    var network = $('#sendBlock').attr('rel');

    $('#fromAddresses input:checked').each(function() {
	var addrString = $(this).attr('rel');
	inputAddresses.push(addrString);
    });

    var totalAmount = new BigNumber(0);
    $('.sendtoRow').each(function() {
	var addrString = $('input[name=address]', this).val();
	if(addrString) {
	    var amountString = $('input[name=amount]', this).val();
	    var amount = richwallet.utils.parseBigNumber(amountString);
	    // FIXME: check addrString and amountString
	    totalAmount = totalAmount.plus(amount);
	    outputs.push({address:addrString, amount:amount});
	}
    });

    var feeString = $('#fee #calculatedFee').val();
    var fee = richwallet.utils.parseBigNumber(feeString);
    if(isNaN(fee) || fee.comparedTo(0) < 0) {
	throw new Error(T('Fee is negative!'));
    }

  var self = this;
  var callback = function(bConfirm){
    if(bConfirm){
      var tx = richwallet.wallet.createAdvTx(network, inputAddresses, outputs, fee);
      var button = this;
      $(button).attr("disabled","disable");
      richwallet.wallet.sendingTXIDs[tx.obj.getHash()] = true;
      self.saveWallet(richwallet.wallet, {override: true}, function(response) {
	$.ajax({
	  url: 'api/infoproxy/sendtx/' + network,
	  data: JSON.stringify({rawtx: tx.raw}),
	  contentType: 'application/json',
	  dataType: 'json',
	  type: 'POST',
	  processData: false,
	  success: function(resp) {
	    $(button).removeAttr("disabled");
	    $("#confirmSend").modal('hide');
	    if(resp.error) {
	      console.error('send raw transaction error', resp.error);
	      return;
	    }
	    self.showSuccessMessage(T("Sent %s %s", totalAmount,
				      richwallet.config.networkConfigs[network].currency));
	    var toAddress = _.map(outputs, function(output) {return output.address});
	    richwallet.wallet.addTx(tx, totalAmount.toString(), feeString, toAddress, '');
	    delete richwallet.wallet.sendingTXIDs[tx.obj.getHash()];
	    self.getUnspent(function() {
	      richwallet.router.route('dashboard');
	    });
	  }
	});
      });
    }
  };

  this.showSendReview({network:network,
		       outputs:outputs,
		       fee:fee}, callback);

};

// quick send
richwallet.controllers.Tx.prototype.showQuickSend = function(address) {
    address = address || '';
    $('#quickSend input[name=address]').val(address);
    $('#quickSend input[name=amount]').val('');
    $('#quickSend #quickSendButton').addClass('disabled');
    this.quickCheckValues();
    $('#quickSend').modal({backdrop: false});

};

richwallet.controllers.Tx.prototype.quickCheckValues = function() {
    var enableButton = true;
    // Address
    var addressDom = $('#quickSend input[name=address]');
    var addressString = addressDom.val();
    var hasError = false;
    var balance = undefined;
    var network = undefined;
    var errorMessages = [];

    if(addressString) {
	try {
	    var addr = new Bitcoin.Address(addressString);
	    network = addr.getNetwork();
	    balance = richwallet.wallet.balanceObject()[network];
	} catch(e) {
	    hasError = true;
	    errorMessages.push('Illegal address' + addressString);
	}
    }
    if(hasError) {
	addressDom.parent().addClass('has-error');
	enableButton = false;
    } else {
	addressDom.parent().removeClass('has-error');
    }
    if(network) {
	$('#quickToCustomSend').removeClass('disabled');
    } else {
	$('#quickToCustomSend').addClass('disabled');
    }

    if(balance) {
	$('#quickSend #balance').html(
	    T("Balance %s %s", balance.toString(),
	      richwallet.config.networkConfigs[network].currency));
    } else {
	$('#quickSend #balance').html('');
    }
    // Amount
    var amountDom = $('#quickSend input[name=amount]');
    var amountString = amountDom.val();
    if(!hasError) {
	if(amountString) {
	    var amount = richwallet.utils.parseBigNumber(amountString);
	    if(isNaN(amount) || amount.comparedTo(minAmount) <= 0) {
		errorMessages.push('Illegal amount');
		hasError = true;
	    } else {
		if(amount.comparedTo(balance) > 0) {
		    hasError = true;
		}
	    }
	} else {
	    enableButton = false;
	}

	if(hasError) {
	    amountDom.parent().addClass('has-error');
	    if(enableButton) {
		enableButton = false;
	    }
	} else {
	    amountDom.parent().removeClass('has-error');
	}
    }

    // Toggle button
    if(enableButton) {
	$('#quickSendButton').removeClass('disabled');
    } else {
	$('#quickSendButton').addClass('disabled');
    }
};

richwallet.controllers.Tx.prototype.quickCreate = function() {
    $('#quickSend').modal('toggle');
    var address = $('#quickSend input[name=address]').val();
    var addr = new Bitcoin.Address(address);
    var network = addr.getNetwork();

    var amountString = $('#quickSend input[name=amount]').val();
    var amount = richwallet.utils.parseBigNumber(amountString);
    var tx = richwallet.wallet.createAdvTx(network,
					   richwallet.wallet.addressHashes(network),
					   [{address:address, amount:amount}],
					   0);
    var fee = richwallet.wallet.feeOfTx(network, tx);
    fee = new BigNumber(fee);
    var balance = richwallet.wallet.balanceObject()[network];
    if(fee.plus(amount).comparedTo(balance) > 0) {
	fee = balance.minus(amount);
    }


  var self = this;
  var callback = function(bConfirm){
    if(bConfirm){

    tx = richwallet.wallet.createAdvTx(network,
				       richwallet.wallet.addressHashes(network),
				       [{address:address, amount:amount}],
				       fee);
    self.saveWallet(richwallet.wallet, {override: true}, function(response) {
	$.ajax({
	    url: 'api/infoproxy/sendtx/' + network,
	    data: JSON.stringify({rawtx: tx.raw}),
	    contentType: 'application/json',
	    dataType: 'json',
	    type: 'POST',
	    processData: false,
	    success: function(resp) {
		if(resp.error) {
		    console.error('send raw transaction error', resp.error);
		    return;
		}

		richwallet.wallet.addTx(tx, amount.toString(), fee.toString(), address, '');
		delete richwallet.wallet.sendingTXIDs[tx.obj.getHash()];
		self.getUnspent(function() {
		    if($('#allTransactions').length > 0) {
			self.showSuccessMessage(
			    T("Sent %s %s", amount,
			      richwallet.config.networkConfigs[network].currency));	
			richwallet.controllers.dashboard.renderDashboard();
		    }
		});
	    }
	});
    });


    }

  };


  this.showSendReview({network:network,
		       fee:fee,
		       outputs:[{address:address, amount:amount}]},
		      callback);



};

richwallet.controllers.Tx.prototype.quickToCustom = function() {
    var addressDom = $('#quickSend input[name=address]');
    var addressString = addressDom.val();

    if(addressString) {
	try {
	    var addr = new Bitcoin.Address(addressString);
	    var network = addr.getNetwork();
	    richwallet.router.route('tx/sendto/' + addressString);
	} catch(e) {
	    console.error(e);
	}
    }
    $('#quickSend').modal('toggle');
};

richwallet.controllers.tx = new richwallet.controllers.Tx();
