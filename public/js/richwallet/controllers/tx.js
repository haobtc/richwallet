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
    if(!tx) {
      self.showErrorMessage(T('Tx %s does not exist', reqObj.tx));
      richwallet.router.route('dashboard');
      return;
    }
    
    var txs = richwallet.wallet.transactions;
    for(var i=0;i<txs.length;i++) {
      if(txs[i].network == tx.network && txs[i].hash == tx.hash) {
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
  $('.alert', newRow).addClass('hidden').html('');
  $('.has-error', newRow).removeClass('has-error');
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
  $('#createSendForm .alert').addClass('hidden');

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
	if(addr.getNetwork() != network &&
	   !_.contains(addr.p2shNetworks(), network)) {
	  errorMessages.push(T('Invalid address'));
	  hasError = true;
	}
      } catch(e) {
	errorMessages.push(T('INvalid address'));
	hasError = true;
      }
    }
    if(hasError) {
      $(this).parent().addClass('has-error');
      $('.alert', $(this).parents('.sendtoRow')).removeClass('hidden').html(errorMessages[0]);
      enableButton = false;
    } else {
      $(this).parent().removeClass('has-error');
    }
  });

  var fee = this.estimateFee();
  $('#calculatedFee').val(fee);
  sumOutputAmount = sumOutputAmount.plus(fee);

  $('.sendtoRow input[name=amount]').each(function() {
    var amountString = $(this).val();
    var hasError = false;
    if(amountString) {
      var amount = richwallet.utils.parseBigNumber(amountString);
      if(isNaN(amount) || amount.comparedTo(minAmount) <= 0) {
	errorMessages.push(T('Illegal amount'));
	hasError = true;
      }
      if(sumOutputAmount.plus(amount).comparedTo(sumInputAmount) > 0) {
	errorMessages.push(T('input < output + fee'));
	hasError = true;
      } else {
	sumOutputAmount = sumOutputAmount.plus(amount);
      }	    
    } else {
      enableButton = false;
    }
    if(hasError) {
      //console.error('error on sending', errorMessages);
      $(this).parent().addClass('has-error');
      $('.alert', $(this).parents('.sendtoRow')).removeClass('hidden').html(errorMessages[0]);
      if(enableButton) {
	enableButton = false;
      }
    } else {
      $(this).parent().removeClass('has-error');
    }
  });

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

richwallet.controllers.Tx.prototype.estimateFee = function() {
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
      if(amountString && !isNaN(parseFloat(amountString))) {
	var amount = richwallet.utils.parseBigNumber(amountString);
	// FIXME: check addrString and amountString
	totalAmount = totalAmount.plus(amount);
	outputs.push({address:addrString, amount:amount});
      }
    }
  });
  return  richwallet.wallet.estimateFee(network, inputAddresses, outputs);
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

  var fee = $('#calculatedFee').val();
  fee = new BigNumber(fee);
  var self = this;

  function confirmTx(bConfirm){
    if(bConfirm){
      var tx = richwallet.wallet.createAdvTx(network, inputAddresses, outputs, fee);
      var button = $("#sendButton");
      button.attr("disabled","disable");

      // spin.js
      var opts = {
	lines: 11, // The number of lines to draw
	length: 0, // The length of each line
	width: 5, // The line thickness
	radius: 11, // The radius of the inner circle
	corners: 1, // Corner roundness (0..1)
	rotate: 0, // The rotation offset
	direction: 1, // 1: clockwise, -1: counterclockwise
	color: '#000', // #rgb or #rrggbb or array of colors
	speed: 1.5, // Rounds per second
	trail: 30, // Afterglow percentage
	shadow: false, // Whether to render a shadow
	hwaccel: false, // Whether to use hardware acceleration
	className: 'spinner', // The CSS class to assign to the spinner
	zIndex: 2e9, // The z-index (defaults to 2000000000)
	top: '50%', // Top position relative to parent
	left: '50%' // Left position relative to parent
      };
      var loading = $("<div>&nbsp;</div>").height(button.height()).width(button.width()).css({'display':'inline-block','position':'relative'});
      button.before(loading);
      var spinner = new Spinner(opts).spin(loading[0]);

      var toAddress = _.map(outputs, function(output) {return output.address});
      richwallet.wallet.addTx(tx, totalAmount.toString(), fee.toString(), toAddress);

      self.showSuccessMessage(T("Sent %s %s", totalAmount,
				richwallet.config.networkConfigs[network].currency));
      richwallet.router.route('dashboard');

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
	      self.showErrorMessage(T("Send Transaction error!"));
	      return;
	    }
	    self.getUnspent(function() {
	    });
	  }
	});
      });
    }
  };

  this.showSendReview({network:network,
		       outputs:outputs,
		       fee:fee}, confirmTx);

};

richwallet.controllers.tx = new richwallet.controllers.Tx();
