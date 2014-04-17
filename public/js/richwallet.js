var richwallet = {};

$.ajax('api/config', {
  async: false,
  complete: function(resp) {
    richwallet.config = resp.responseJSON;
  }
});

var supportedLangs = {'zh-cn': true};
richwallet.trans = {};
var language = navigator.language.toLowerCase();
if(supportedLangs[language]) {
    $.ajax('lang/' + language + '.json', {
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

 
      
