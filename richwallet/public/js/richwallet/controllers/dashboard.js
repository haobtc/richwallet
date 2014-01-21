richwallet.controllers.Dashboard = function() {};

richwallet.controllers.Dashboard.prototype = new richwallet.Controller();

richwallet.controllers.Dashboard.prototype.renderDashboard = function() {
  var i = 0;
  var self = this;
  $('#balance').text(richwallet.wallet.safeUnspentBalance());
  $('#pendingBalance').text(richwallet.wallet.pendingUnspentBalance());

  var txHashes = [];
  var txs = richwallet.wallet.transactions;

  for(i=0;i<txs.length;i++) {
    txHashes.push({tx:txs[i].hash, network:txs[i].network});
  }

  $.post('/api/tx/details', {txHashes: txHashes}, function(resp) {
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

    self.template('sentTransactions', 'dashboard/sent', {tx: stxs.reverse()}, function(id) {
      $('#'+id+" [rel='tooltip']").tooltip();
      self.updateExchangeRates(id);
    });
    self.template('receivedTransactions', 'dashboard/received', {category: 'Received', tx: rtxs.reverse()}, function(id) {
      self.updateExchangeRates('receivedTransactions');
      $('#'+id+" [rel='tooltip']").tooltip();
    });
  });
};

richwallet.controllers.Dashboard.prototype.index = function() {
  var i = 0;
  var self = this;

  this.render('dashboard', {}, function() {
    if(!self.firstDashboardLoad) {
      self.firstDashboardLoad = true;
      self.getUnspent(function() {
        self.renderDashboard();
      });
    } else {
      self.renderDashboard();
    }
  });
};

richwallet.controllers.Dashboard.prototype.updateExchangeRates = function(id) {
  richwallet.pricing.getLatest(function(price, currency) {
    $('#balanceExchange').text(' ≈ '+ parseFloat(price * $('#balance').text()).toFixed(2) + ' ' + currency);
    $('#exchangePrice').text('1 BTC ≈ ' + price + ' ' + currency);

    $('#'+id+' .exchangePrice').remove();

    var prices = $('#'+id+' .addExchangePrice');
    for(var i=0;i<prices.length;i++) {
      $(prices[i]).append('<span class="exchangePrice pull-right"><small>'+($(prices[i]).text().split(' ')[0] * price).toFixed(2)+' ' +currency+'</small></span>');
    }
  });
};

richwallet.controllers.dashboard = new richwallet.controllers.Dashboard();
