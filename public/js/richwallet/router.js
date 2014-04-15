richwallet.router = Path;

richwallet.router.render = function(id, path, data, callback) {
  richwallet.Template.draw('header', 'header', data, callback);
  richwallet.Template.draw(id, path, data, callback);
};

richwallet.router.route = function(path) {
  window.location.href = '#/'+path;
};

var sock = null;

richwallet.router.walletRequired = function() {
  if(!richwallet.wallet)
    richwallet.router.route('signup');
};

richwallet.router.listener = function() {
    if(richwallet.router.listenerTimeout) {
	clearInterval(richwallet.router.listenerTimeout);
    }
    richwallet.router.listenerTimeout = setInterval(function() {
	richwallet.controllers.dashboard.getUnspent(function() {
            var rt = $('#receivedTransactions');
            if(rt.length == 1) {
		richwallet.controllers.dashboard.renderDashboard();
	    }
	});
    }, 30000);
};

richwallet.router.listener1111 = function() {
  var path = window.location.pathname;
  path = path.replace(/[^\/]*$/, '');
  path += 'listener';
  sock = new SockJS(window.location.protocol + '//' + window.location.host + path);
  var self = this;

  window.onbeforeunload = function () {
    if(sock) {
      sock.close();
    }
  }

  sock.onopen = function() {
    richwallet.router.listenerTimeout = setInterval(function() {
	sock.send(JSON.stringify(
	    {method: 'listUnspent',
	     addresses: richwallet.wallet.addressHashes()}));
    }, 30000);
  };
  
  sock.onmessage = function(res) {
    var resData = JSON.parse(res.data);
    if(resData.method == 'listUnspent') {
      if(richwallet.controllers.dashboard) {
	  richwallet.controllers.dashboard.mergeUnspent(resData.result, function() {
              var rt = $('#receivedTransactions');
              if(rt.length == 1)
		  richwallet.controllers.dashboard.renderDashboard();
	  });
      }
    }
  };

  sock.onclose = function() {
    clearInterval(richwallet.router.listenerTimeout);
    if(richwallet.wallet)
      setTimeout("richwallet.router.listener()", 5000);
  };
};

richwallet.router.initWallet = function(callback) {
  if(richwallet.wallet)
    return callback(true);

  richwallet.router.route('signin');
};

richwallet.router.map('#/backup/download').to(function() {
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    var payload = richwallet.wallet.encryptPayload();
    var blob = new Blob([payload], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "richwallet-wallet.txt");
    richwallet.router.route('backup');
  });
});

richwallet.router.map('#/backup').to(function() {
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.router.render('view', 'backup');
  });
});

richwallet.router.map("#/signup").to(function() {
  richwallet.router.render('view', 'signup');
});

richwallet.router.map("#/signin").to(function() {
  if(richwallet.wallet)
    return richwallet.router.render('view', 'dashboard');
  return richwallet.router.render('view', 'signin');
});

richwallet.router.map("#/signout").to(function() {
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.wallet = null;
    clearInterval(richwallet.router.listenerTimeout);
    richwallet.controllers.dashboard.firstDashboardLoad = false;
    richwallet.router.route('signin');
  });
});

richwallet.router.map("#/dashboard").to(function() {
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.controllers.dashboard.index();
  });
});

richwallet.router.map('#/tx/details/:hash').to(function() {
  var hash = this.params['hash'];
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.controllers.tx.details(hash);
  });
});

richwallet.router.map('#/tx/details/:network/:hash').to(function() {
  var network = this.params['network'];
  var hash = this.params['hash'];
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.controllers.tx.details(hash, network);
  });
});

richwallet.router.map('#/tx/send').to(function() {
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.controllers.tx.send();
  });
});

richwallet.router.map('#/tx/sendto/:address').to(function() {
  var address = this.params.address;
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.controllers.tx.send(address);
  });
});

richwallet.router.map('#/accounts/import').to(function() {
  if(richwallet.wallet) {
    richwallet.router.route('dashboard');
  } else {
    // Check for the various File API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      richwallet.router.render('view', 'accounts/import');
    } else {
      alert('Importing is not supported in this browser, please upgrade.');
      richwallet.router.route('signin');
    }
  }
});

richwallet.router.map('#/node_error').to(function() {
  richwallet.router.render('container', 'node_error');
});

richwallet.router.map('#/account/settings').to(function() {
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.router.render('view', 'accounts/settings');
  });
});

richwallet.router.map('#/addresses/list').to(function() {
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.controllers.addresses.list();
  });
});

richwallet.router.map('#/addresses/request/:address').to(function() {
  var address = this.params['address'];
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.controllers.addresses.request(address);
  });
});

richwallet.router.map('#/').to(function() {
/*
  if(window.navigator.registerProtocolHandler)
    window.navigator.registerProtocolHandler(
      "bitcoin",
      document.URL.substring(0,document.URL.lastIndexOf("#"))+"/?uri=%s",
      "Richwallet"
    );
*/
  richwallet.router.initWallet(function(res) {
    if(res == false)
      return;
    richwallet.router.route('dashboard');
  });
});

richwallet.router.root("#/");
richwallet.router.listen();
