var richwallet = {};

$.ajax('api/config', {
  async: false,
  complete: function(resp) {
    richwallet.config = resp.responseJSON;
  }
});

var supportedLangs = {'zh-CN': true};
richwallet.trans = {};
if(supportedLangs[navigator.language]) {
    $.ajax('lang/' + navigator.language + '.json', {
	async: false,
	success: function(resp) {
	    richwallet.trans = resp;
	}
    });
}

function T(fmt) {
    fmt = richwallet.trans[fmt] || fmt;
    for(var i=1; i<arguments.length; i++) {
	fmt = fmt.replace('%s', arguments[i]);
    }
    return fmt;
}

 
      
