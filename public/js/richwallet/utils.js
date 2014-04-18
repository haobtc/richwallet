richwallet.utils = {};

// https://github.com/component/escape-html
richwallet.utils.stripTags = function(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

richwallet.utils.shortText = function(text, secLength) {
    secLength = secLength || 4;
    if(text.length > 2 * secLength + 1) {
	return text.substr(0, secLength) + '...' + text.substr(text.length - secLength);
    } else {
	return text;
    } 
};
