module.exports = function(text, origTree) {
  // This is my quick and dirty version of handlebars
  var re = function(name) {
    return new RegExp('{{' + name + '}}', 'g');
  },
    replaceables,
    replaceAddress,
    replaceValueId,
    treeSearch = function(addresses, tree) {
      if (tree[addresses[0]]) {
        if (addresses.length > 0 && typeof(tree[addresses[0]]) === 'object') {
          return treeSearch(addresses.slice(1), tree[addresses[0]]);
        } else if (typeof(addresses.length === 1 && tree[addresses[0]]) === 'string') {
          return tree[addresses[0]];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    };
  if (Object.prototype.toString.call(origTree) === '[object Object]') {
    replaceables = text.match(re('.+?'));
    if (replaceables) {
      for (replaceValueId = 0; replaceValueId < replaceables.length; replaceValueId++) {
        replaceAddress = replaceables[replaceValueId].replace(re('(.+?)'), '$1').split('.');
        text = text.replace(replaceables[replaceValueId], treeSearch(replaceAddress, origTree));
      }
    }
  }

  return text;
}
