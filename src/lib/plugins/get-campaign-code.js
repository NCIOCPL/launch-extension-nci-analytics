'use strict';

var queryString = require('@adobe/reactor-query-string');
var window = require('@adobe/reactor-window');

/**
 * Gets the Campaign code from either cid/gcid or UTM parameters
 * @returns string The extracted campaign code
 */
module.exports = function() {
  var queryParams = queryString.parse(window.location.search);

  var campaign = queryParams['cid'] || queryParams['gclid'];
  if (!campaign) {
    var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    campaign = utmKeys
                    .map(function(utm_param){
                      return (queryParams[utm_param]) ? queryParams[utm_param] : '_'
                    })
                    .join("|");
    // If no query params exist, unset campaign
    campaign = (campaign !== '_|_|_|_|_') ? campaign : undefined;
  }

  return campaign;
}
