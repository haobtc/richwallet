var multijson = require("multijson-config")
var path = require('path');
var fs = require('fs');

try {
  var devPath = path.resolve(__dirname, '..', '..','..', 'config.template.json')
  console.log(devPath)
  var prodPath = path.resolve(__dirname, '..', '..', '..', 'config.json')
  var config = multijson.parseJSONFiles(devPath,prodPath)
  console.log(config)
    //fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'config.json'));
  module.exports = config
} catch(err) {
  if(err.message.match('ENOENT') != null) {
    console.log('config.json or config.template.json not found, you need to create one.')
    process.exit(1);
  } else
    throw(err);
}
