richwallet.controllers.Dashboard = function() {};

richwallet.controllers.Dashboard.prototype = new richwallet.Controller();

richwallet.controllers.Dashboard.prototype.renderDashboard = function() {
  var i = 0;
  var self = this;
  var balances = richwallet.wallet.balances();
  /*$('#balance').text(richwallet.wallet.safeUnspentBalance());
  $('#pendingBalance').text(richwallet.wallet.pendingUnspentBalance()); */

  var txHashes = [];
  var txs = richwallet.wallet.transactions;

  for(i=0;i<txs.length;i++) {
    txHashes.push({tx:txs[i].hash, network:txs[i].network});
  }
  
  this.getTxDetails(txHashes, function(resp) {
//  $.post('/api/tx/details', {txHashes: txHashes}, function(resp) {
    for(i=0;i<txs.length;i++) {
      for(var j=0;j<resp.length;j++) {
        if(txs[i].hash == resp[j].hash)
          txs[i].confirmations = resp[j].confirmations;
      }
    }

    var stxs = [];
    for(i=0;i<txs.length;i++)
      if(txs[i].type == 'send')
        stxs.push(txs[i]);

    var rtxs = [];
    for(i=0;i<txs.length;i++)
      if(txs[i].type == 'receive')
        rtxs.push(txs[i]);

    self.template('currencyBalances', 'dashboard/balances', {balances:balances}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
    });
    self.template('sentTransactions', 'dashboard/sent', {tx: stxs.reverse()}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
    });
    self.template('receivedTransactions', 'dashboard/received', {category: 'Received', tx: rtxs.reverse()}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
    });
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

richwallet.controllers.dashboard = new richwallet.controllers.Dashboard();
