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
    $.post('/api/proxy/' + network + '/' + command, {args: args}, function(resp) {
	if(callback) {
	    var err = resp[0];
	    var data = resp[1];
	    callback(err, data);
	}
    });
};
