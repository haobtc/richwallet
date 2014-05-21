richwallet.LocalProfile = function(userKey) {
  this.userKey = userKey;
  var data = localStorage.getItem("profile_" + userKey);
  if(data)
    this.profile = JSON.parse(data)
  else
    this.profile = {};
};

richwallet.LocalProfile.prototype.saveProfile = function(){
  localStorage.setItem("profile_" + this.userKey, JSON.stringify(this.profile));
};

richwallet.LocalProfile.prototype.set = function(name, value){
  this.profile[name] = value;
  this.saveProfile();
}

richwallet.LocalProfile.prototype.get = function(name){
  return this.profile[name];
}

