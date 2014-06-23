richwallet.controllers.Dashboard = function() {};

richwallet.controllers.Dashboard.prototype = new richwallet.Controller();

richwallet.controllers.Dashboard.prototype.renderDashboard = function() {
    var i = 0;
    var self = this;

    /*$('#balance').text(richwallet.wallet.safeUnspentBalance());
      $('#pendingBalance').text(richwallet.wallet.pendingUnspentBalance()); */
    var txs = _.filter(richwallet.wallet.transactions, function(tx){return tx.confirmations == undefined || tx.confirmations <= 100});
    var txHashes = [];

    function drawDashboard() {
      var balances = richwallet.wallet.balanceForNetworks();
      var sortedTxs = richwallet.wallet.transactions.sort(function(a, b) {return b.time - a.time;});
      
      self.template('currencyBalances', 'dashboard/balances', {balances:balances}, function(id) {
	$('#'+id+" [rel='tooltip']").tooltip();
      });

      self.template('allTransactions', 'dashboard/transactions', {tx:sortedTxs}, function(id) {
	$('#'+id+" [rel='tooltip']").tooltip();
      });
    }

    drawDashboard();
    for(i=0;i<txs.length;i++) {
	txHashes.push({tx:txs[i].hash, network:txs[i].network});
    }
  
    this.getTxDetails(txHashes, function(resp) {
	var removableTxes = {};
	var hasRemovable = false;
	for(i=0;i<txs.length;i++) {
	  var j=0;
	  for(;j<resp.length;j++) {
	    if(txs[i].hash == resp[j].hash) {
	      txs[i].confirmations = resp[j].confirmations;
	      break;
	    }
	  }
	  if(j >= resp.length && txs[i].confirmations == 0) {
	    // Not found
	    if(txs[i].sending > 0) {
	      txs[i].sending--;
	    } else {
	      removableTxes[txs[i].hash] = true;
	      hasRemovable = true;
	    }
	  }
	}
	if(hasRemovable) {
	  richwallet.wallet.transactions = _.reject(richwallet.wallet.transactions, function(tx) {return removableTxes[tx.hash]});
	  self.saveWallet(richwallet.wallet, {override: true}, function(){});
	}
	drawDashboard();
  });
};

richwallet.controllers.Dashboard.prototype.index = function() {
  var i = 0;
  var self = this;

  this.render('dashboard', {}, function() {
    if(!self.firstDashboardLoad) {
      $('.loading').show();
      self.firstDashboardLoad = true;
      self.getUnspent(function() {
        $('.loading').remove();
        self.renderDashboard();
      });
    } else {
      self.renderDashboard();
    }
  });
};

richwallet.controllers.Dashboard.prototype.getTxIDList = function(callback) {
  var self = this;
  var query = {addresses: richwallet.wallet.addressHashes()};
  if(!query.addresses || query.addresses.length == 0) {
    return;
  }
  var jsonpUrl = 'api/infoproxy/tx/list';
  $.post(jsonpUrl, {addresses:query.addresses.join(',')}, function(resp) {

    var txIDs = {};
    _.map(richwallet.wallet.transactions, function(tx) {
      txIDs[tx.network + ':' + tx.hash] = true;
    });
    _.map(richwallet.wallet.archived, function(txd) {
      txIDs[txd] = true;
    });

    var newTxHashes = [];
    for(var netname in resp) {
      resp[netname].forEach(function(txid) {
	if(!txIDs[netname + ':' + txid]) {
	  // New tx which is not recorded 
	  newTxHashes.push({
	    network: netname,
	    tx: txid
	  });
	}
      });
    }
    if(newTxHashes.length > 0) {
      richwallet.wallet.updateTransactions(newTxHashes, callback);
    } else {
      callback();
    }
  }, 'json');
};

richwallet.controllers.dashboard = new richwallet.controllers.Dashboard();
