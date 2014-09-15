var richwallet = {};

var networkConfigs = {
  "bitcoin": {
    "leadingChar": "1", 
    "version": 0, "p2sh": 5, "keyVersion":128,
    "currency": "BTC",
    "fee": 0.0001,
  },
  "litecoin": {
    "leadingChar": "L", 
    "version": 48, "p2sh": 5, "keyVersion":176,
    "currency": "LTC",
    "fee": 0.001
  },
  "dogecoin": {
    "leadingChar": "D", 
    "version": 30, "p2sh": 0x16, "keyVersion":158,
    "currency": "DOG",
    "fee": 1.0
  },
  "darkcoin": {
    "leadingChar": "X", 
    "version": 0x4C, "p2sh": 5, "keyVersion":204,
    "currency": "DRK",
    "fee": 0.01
  }
};

$.ajax('api/config', {
  async: false,
  complete: function(resp) {
    richwallet.config = resp.responseJSON;
    richwallet.config.networkConfigs = networkConfigs;
    richwallet.config.sortedNetworks = ['bitcoin', 'litecoin', 'dogecoin', 'darkcoin'];
  }
});

var supportedLangs = {'zh-cn': true};
var entrans = {
    "propaganda.intro": "OpenBlock is a free online crypto currencies wallet which you can use to make worldwide payments for free. We are not a bank, you retain complete ownership of your Money. We cannot view your balance, see your transactions or make payments on your behalf.",
    "intro.secure": "Your wallet  is encrypted  within your browser, before it is saved on our servers, so not even we have access to your account!",
    "intro.OpenBlock": "BTC, LTC, DOGECOIN and any other cryptcoins all storeed in OpenBlock, supported types of coins are keep increasing.",
    "intro.open": "Richwallet is an <a href=\"https://github.com/haobtc/richwallet\" target=\"_blank\">open source service</a>, please feel free to use it and contrib to it. Richwallet also benifits from other open source project <a href=\"https://github.com/kyledrake/coinpunk\" target=\"\">coinpunk</a> thanks to open source community.",

    "signup.alert": ("<h3><font color=\"red\">IMPORTANT</font> password information:</h3>" +
		     "<p>Your data is being encrypted in a way that the server cannot spend your coin wallet money. If you lose your password, there is no way to reset it.</p>" +
		     "<h4><strong>Losing your password is like losing your real-life wallet. You will lose your bitcoins, <u>forever</u></strong>.<br/><u>Remember your password</u>.</h4>" +
		     "<p>Your password must also be a minimum of <b>10 characters</b>. If you're making a new password, write it down somewhere. You will likely forget it if you don't.</p>"),
    "twofactor.alert": "Two factor authentication allows you to require a code from your phone from Login. It increases your security level drastically. Make <a href=\"#/account/settings\" class=\"text-warning\">two factor authenticaton</a> is highly recommended.",
    "doge.merge.alert": "Dogecoin is undergoing a merged mining with litecoin, currently we are fixing this problem, please don't transfer you DOGEs for the time being, your balance will be right eventually. Sorry for the inconvenances."
};
richwallet.trans = {};
for (var key in entrans) {
  richwallet.trans[key] = entrans[key];
}

var language = getCookie("lang") || navigator.language.toLowerCase();
richwallet.nextlang = "";
richwallet.nextlangTxt = ""

if(supportedLangs[language]){
    $.ajax('lang/' + language + '.json', {
	async: false,
	success: function(resp) {
	    for(var key in resp) {
		  richwallet.trans[key] = resp[key];
	    }
	  richwallet.nextlangTxt = "English";
	  richwallet.nextlang = "en";
	}
    });
} else {
  richwallet.nextlangTxt = "简体中文";
  richwallet.nextlang = "zh-cn"
}

function changelang(){
  if (supportedLangs[richwallet.nextlang]) {
	$.ajax('lang/' + language + '.json', {
	async: false,
	success: function(resp) {
	  richwallet.trans = {};
	  for(var key in resp) {
		richwallet.trans[key] = resp[key];
	  }
	}
    });
	setCookie("lang","zh-cn","d30");
  } else {
	richwallet.trans = {};
	for (var key in entrans) {
	  richwallet.trans[key] = entrans[key];
	}
	setCookie("lang","en","d30");
  }

	
	window.location.reload();
	if (richwallet.nextlang=="zh-cn") {
	  richwallet.nextlang = "en";
	  richwallet.nextlangTxt = "English";
	} else  {
	  richwallet.nextlang = "zh-cn"
	  richwallet.nextlangTxt = "简体中文";
	}
}



function T(fmt) {
    fmt = richwallet.trans[fmt] || fmt;
    for(var i=1; i<arguments.length; i++) {
	fmt = fmt.replace('%s', arguments[i]);
    }
    return fmt;
}

function getCookie(name) 
{ 
  var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
  if(arr=document.cookie.match(reg))
	return unescape(arr[2]); 
  else 
    return null; 
} 

function setCookie(name,value,time)
{ 
  var strsec = getsec(time); 
  var exp = new Date(); 
  exp.setTime(exp.getTime() + strsec*1); 
  document.cookie = name + "="+ escape (value) + ";expires=" + exp.toGMTString(); 
} 
function getsec(str)
{ 
   var str1=str.substring(1,str.length)*1; 
   var str2=str.substring(0,1); 
   if (str2=="s")
   { 
        return str1*1000; 
   }
   else if (str2=="h")
   { 
       return str1*60*60*1000; 
   }
   else if (str2=="d")
   { 
       return str1*24*60*60*1000; 
   } 
} 
