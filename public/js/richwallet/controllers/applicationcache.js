richwallet.controllers.ApplicationCache = function(){
  this.checkVersionTime = 60000;
};

richwallet.controllers.ApplicationCache.prototype.alert = function(){
  var dialog = $("#updateCacheDialog");
  if(dialog.length < 1){
    dialog = $("<div class=\"modal fade\" id=\"updateCache\" tabindex=\"-1\">
                  <div class=\"modal-dialog modal-sm\">
                    <div class=\"modal-content\">
                      <div class=\"modal-body\">
                        <div class=\"col-lg-12 text-center text-danger\" style=\"padding:40px 0px 40px 0px;\">
                        </div>
                        <div class=\"text-center\">
                          <button type=\"button\" class=\"btn btn-primary\"></button>
                        </div>
                     </div>
                   </div>
                 </div>
               </div>");
    dialog.appendTo($(document.body));
  }
  dialog.find("div.text-danger").text(T('A new version of onewallet is available. Restart is required!'));
  dialog.find("button").text(T("Restart wallet after %s seconds", 10)).off("click").on("click", function(){
    window.location.reload();
  });
  var sec = 10;
  var func = function(){
    sec--;
    $("#updateCache button").text(T("Restart wallet after %s seconds", sec));
    if(sec > 0){
      window.setTimeout(func, 1000);
    }
    else{
      window.setTimeout("window.location.reload();",1000);
    }
  }
  $("#updateCache").modal({"backdrop":false,
			   "keyboard":false});
  window.setTimeout(func,1000);
  dialog.modal({backdrop:false,
		keyboard:false});
};


richwallet.controllers.ApplicationCache.prototype.setup = function(){
  var self = this;
  window.applicationCache.addEventListener('updateready', function(e) {
    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
      window.applicationCache.swapCache();
      self.alert();
    }
  }, false);
  window.setInterval("window.applicationCache.update();",this.checkVersionTime);
};


richwallet.controllers.applicationCache = new richwallet.controllers.ApplicationCache();
