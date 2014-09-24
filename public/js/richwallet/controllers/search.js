function Search() {};

Search.prototype = new richwallet.Controller();

Search.prototype.performSearch = function() {
  var val = $.trim($('#searchTerm').val());
  if(val) {
    richwallet.router.route('search/' + encodeURIComponent(val));
  }
}

Search.prototype.searchTerm = function(term) {
  var self = this;
  try {
    if(term) {
      if(/^[0-9a-fA-F]{64}$/.test(term)) {
	// term is txid
	return this.searchTx(term);
      } else if(/^[1-9a-zA-Z]{33,35}$/.test(term)){
	// term may be address
	var addr = new Bitcoin.Address(term);
	return this.searchAddress(term, addr.getNetwork());
      }
    }
    self.render('search/noresult', {}, function(id){});
  } catch(e) {
    console.error(e);
  }
};

var txSearchResults = {};
Search.prototype.searchTx = function(txHash) {
  if(txSearchResults[txHash]) {
    return this.render('search/tx', txSearchResults[txHash], function(id) {});
  }
  var self = this;
  var query = [];
  for(var network in richwallet.config.networkConfigs) {
    query.push({network: network, tx:txHash});
  }
  this.getTxDetails(query, function(resp) {
    if(resp.length == 0) {
      return self.render('search/noresult', {});
    }
    txSearchResults[txHash] = {txlist:resp};
    self.render('search/tx', txSearchResults[txHash], function(id){});
  });
};

var addressSearchResults = {};
Search.prototype.searchAddress = function(address, network) {
  if(addressSearchResults[address]) {
    return this.render('search/address', addressSearchResults[address], function(id) {});
  }
  var self = this;
  var balance = new BigNumber(0);

  $.post('api/infoproxy/unspent', {addresses:address}, function(resp) {
    _.map(resp, function(uspt) {
      balance = balance.plus(new BigNumber(uspt.amount));
    });
    $.post('api/infoproxy/tx/list', {addresses:address, detail:'yes'}, function(resp) {
      var txlist = resp[network] || [];
      txlist.forEach(function(tx) {
	var val = new BigNumber(0);
	tx.inputs.forEach(function(txIn) {
	  if(txIn.address == address) {
	    val = val.minus(txIn.amount);
	  }
	});
	tx.outputs.forEach(function(txOut) {
	  if(txOut.address == address) {
	    val = val.plus(txOut.amount);
	  }
	});
	tx.value = val;
      });
      var isSelf = _.contains(richwallet.wallet.addressHashes(network), address);
      addressSearchResults[address] = {txlist: txlist, balance: balance, address: address,
				       network: network, isSelf: isSelf};
      self.render('search/address', addressSearchResults[address], function(id) {});
    });
  });
};

richwallet.controllers.search = new Search();
