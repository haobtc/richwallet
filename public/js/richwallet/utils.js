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

richwallet.utils.shortText = function(text, secLength) {
    secLength = secLength || 6;
    if(text.length > 2 * secLength + 1) {
	return text.substr(0, secLength) + '...' + text.substr(text.length - secLength);
    } else {
	return text;
    } 
};

richwallet.utils.amountToSatoshi = function(amount) {
    var amountSatoshiString = new BigNumber(amount).times(Math.pow(10,8)).round().toString();
    return new Bitcoin.BigInteger(amountSatoshiString);
};

richwallet.utils.parseBigNumber = function(val) {
    if(val instanceof BigNumber) {
	return val;
    } else {
	try {
	    return new BigNumber(val);
	} catch(e) {
	    console.error('check', val, e.message, e.stack);
	    return NaN;
	}
    }
};
