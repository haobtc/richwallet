var config     = require('./config');
var Bitcoind   = require('./bitcoind');

module.exports.getNetworkByAddress = function(addressString) {
    var leadingChar = addressString.substr(0, 1);
    for(var network in config.networks) {
	var conf = config.networks[network];
	if(conf.leadingChar === leadingChar) {
	    return network;
	}
    }
    return null;
}

module.exports.clusterAddresses = function(addressList) {
    var cluster = {};
    //for(var  addressString in addre) {
    addressList.forEach(function(addressString) {
	var network = module.exports.getNetworkByAddress(addressString);
	var addrList = cluster[network];
	if(!addrList) {
	    addrList = [addressString];
	    cluster[network] = addrList;
	} else {
	    addrList.push(addressString);
	}
    });
    var networkList = [];
    for(var network in cluster) {
	networkList.push({"network": network, "addresses": cluster[network]});
    }
    return networkList;
};

module.exports.addressesByNetwork = function(addresses, network) {
    var conf = config.networks[network];
    var filtered = [];
    addresses.forEach(function (addr) {
	if(addr.substr(0, 1) == conf.leadingChar) {
	    filtered.push(addr);
	}
    });
    return filtered;
};

module.exports.rpcServer = function(network, opts) {
    var conf = config.networks[network];
    if(!conf) {
	throw new Error('Cannot find network ' + network);
    }
    return new Bitcoind(conf.rpcserver, opts);
};

module.exports.rpcServerByAddress = function(addressString, opts) {
    var network = module.exports.getNetworkByAddress(addressString);
    return module.exports.rpcServer(network, opts);
};

module.exports.eachNetwork = function(mapper, reducer, callback) {
    var r = [];
    for(var network in config.networks) {
	r.push(network);
    }
    var res = {};
    function emit(obj) {
	reducer.call(res, obj);
	r.shift();
	if(r.length <= 0) {
	    callback(res);
	}
    }
    for(var network in config.networks) {
	mapper(network, emit);
    }
};
