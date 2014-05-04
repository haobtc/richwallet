richwallet.Database = function() {
  this.richwalletCurrencyName = 'richwalletCurrency';
  this.storage       = localStorage;
};

richwallet.Database.prototype.setCurrency = function(currency) {
  return localStorage.setItem(this.richwalletCurrencyName, currency);
};

richwallet.Database.prototype.getCurrency = function() {
  return localStorage.getItem(this.richwalletCurrencyName);
};

richwallet.database = new richwallet.Database();
