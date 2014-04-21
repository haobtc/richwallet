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
    "intro.onewallet": "BTC, LTC, DOGECOIN and any other cryptcoins all storeed in one wallet, supported types of coins are keep increasing.",
    "intro.open": "Richwallet is an <a href=\"https://github.com/haobtc/richwallet\" target=\"_blank\">open source service</a>, please feel free to use it and contrib to it. Richwallet also benifits from other open source project <a href=\"https://github.com/kyledrake/coinpunk\" target=\"\">coinpunk</a> thanks to open source community.",

    "signup.alert": ("<h3><font color=\"red\">IMPORTANT</font> password information:</h3>" +
		     "<p>Your data is being encrypted in a way that the server cannot spend your coin wallet money. If you lose your password, there is no way to reset it.</p>" +
		     "<h4><strong>Losing your password is like losing your real-life wallet. You will lose your bitcoins, <u>forever</u></strong>.<br/><u>Remember your password</u>.</h4>" +
		     "<p>Your password must also be a minimum of <b>10 characters</b>. If you're making a new password, write it down somewhere. You will likely forget it if you don't.</p>")
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

 
      
