var base58 = require('./base58');
var Crypto = require('./crypto-js/crypto');
var conv = require('./convert');

var Address = function (bytes, network) {
  if (typeof bytes === 'string') {
    // bytes is an address string such as LVgwn1DTmrqbAR5H4Ey66FGUUVt56oWp6Q
    // in this case the argument network is not used
    this.decodeAddress(bytes);
    this.getNetwork();
  } else {
    // bytes is the public key hash
    this.hash = bytes;
    this.version = richwallet.config.networkConfigs[network].version;
  }
};

/**
 * Get the network according to its first char: the version
 * for bitcoin it's 0
 * for bitcoin testnet it's 111
 * for litecoin it's 48
 */
Address.prototype.getNetwork = function () {
    for(var nw in richwallet.config.networkConfigs) {
	var conf = richwallet.config.networkConfigs[nw];
	if (conf.version == this.version ||
	    conf.p2sh == this.version) {
	    return nw;
	}
    }
    throw new Error('Unknown address type');
};

/**
 * Serialize this object as a standard Bitcoin address.
 *
 * Returns the address as a base58-encoded string in the standardized format.
 */
Address.prototype.toString = function () {
  // Get a copy of the hash
  var hash = this.hash.slice(0);

  // Version
  hash.unshift(this.version);

  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  var bytes = hash.concat(checksum.slice(0,4));

    var v =  base58.encode(bytes);
    return v;
};

Address.prototype.getHashBase64 = function () {
  return conv.bytesToBase64(this.hash);
};

/**
 * Parse a Bitcoin address contained in a string.
 */
Address.prototype.decodeAddress = function(string) {
  var bytes = base58.decode(string);

  var hash = bytes.slice(0, 21);

  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  if (checksum[0] != bytes[21] ||
      checksum[1] != bytes[22] ||
      checksum[2] != bytes[23] ||
      checksum[3] != bytes[24]) {
    throw new Error('Address Checksum validation failed: ' + string);
  }

  var version = hash.shift();
  this.hash = hash;
  this.version = version;
};

module.exports = Address;
