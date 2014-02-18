richwallet.utils = {};

// https://github.com/component/escape-html
richwallet.utils.stripTags = function(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

richwallet.utils.callRPC = function(network, command, args, callback) {
    $.ajax({
	url: '/api/proxy/' + network + '/' + command,
	data: JSON.stringify({args: args}),
	contentType: 'application/json',
	dataType: 'json',
	success: function(resp) {
	    if(callback) {
		var err = resp[0];
		var data = resp[1];
		callback(err, data);
	    }
	},
	type: 'POST',
	processData: false
    });
};

richwallet.utils.broadcastRPC = function(command, args, callback) {
    $.ajax({
	url: '/api/bproxy/' + command,
	data: JSON.stringify({args: args}),
	contentType: 'application/json',
	dataType: 'json',
	success: callback,
	type: 'POST',
	processData: false
    });
};


richwallet.utils.clusterAddresses = function(addressHashes) {
  var networkAddrs = {};
  for(var i=0; i<addressHashes.length; i++) {
    var addrHash = addressHashes[i];
    var addrObj = new Bitcoin.Address(addrHash);
    var addrList = networkAddrs[addrObj.getNetwork()];
    if(addrList) {
	addrList.push(addrHash);
    } else {
        addrList = [addrHash];
	networkAddrs[addrObj.getNetwork()] = addrList;
    }
  }
  return networkAddrs;
};
