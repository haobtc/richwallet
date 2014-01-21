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

richwallet.Database.prototype.setSuccessMessage = function(message) {
  return localStorage.setItem('successMessage', message);
};

richwallet.Database.prototype.getSuccessMessage = function() {
  var msg = localStorage.getItem('successMessage');
  localStorage.removeItem('successMessage');
  return msg;
};

richwallet.database = new richwallet.Database();
