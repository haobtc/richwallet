var richwallet = {};

$.ajax('api/config', {
  async: false,
  complete: function(resp) {
    richwallet.config = resp.responseJSON;
  }
});

var supportedLangs = {'zh-cn': true};
richwallet.trans = {
    "propaganda.intro": "One Wallet is a free online crypto currencies wallet which you can use to make worldwide payments for free. We are not a bank, you retain complete ownership of your Money. We cannot view your balance, see your transactions or make payments on your behalf.",
    "intro.secure": "Your wallet  is encrypted  within your browser, before it is saved on our servers, so not even we have access to your account!",
    "intro.onewallet": "BTC, LTC, DOGECOIN and any other cryptcoins  all in one wallet",
    "intro.open": "Richwallet is an <a href=\"https://github.com/haobtc/richwallet\" target=\"_blank\">open source service</a>, please feel free to use it and contrib to it. Richwallet also benifits from other open source project <a href=\"https://github.com/kyledrake/coinpunk\" target=\"\">coinpunk</a> thanks to open source community."
};
var language = navigator.language.toLowerCase();
if(supportedLangs[language]) {
    $.ajax('lang/' + language + '.json', {
	async: false,
	success: function(resp) {
	    for(var key in resp) {
		richwallet.trans[key] = resp[key];
	    }
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

 
      
