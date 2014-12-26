var multijson = require("multijson-config")
var path = require('path');
var fs = require('fs');

var devPath = path.resolve(__dirname, '..', '..','..', 'config.template.json')
var prodPath = path.resolve(__dirname, '..', '..', '..', 'config.json')
var config = multijson.parseJSONFiles(devPath,prodPath)
module.exports = config
