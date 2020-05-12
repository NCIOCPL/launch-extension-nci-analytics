'use strict';

var queryString = require('@adobe/reactor-query-string');
var window = require('@adobe/reactor-window');

/**
 * Gets the Campaign code from either cid/gcid or UTM parameters
 * @returns string The extracted campaign code
 */
module.exports = function() {
  var queryParams = queryString.parse(window.location.search);

  // Use Adobe Campaign Tracking First
  var campaign = queryParams.cid;

  // Fallback to looking for Google Campaign tracking
  if (!campaign) {
    var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    campaign = utmKeys
      .map(function(utmParam) {
        return (queryParams[utmParam]) ? queryParams[utmParam] : '_';
      })
      .join('|');
    // If no query params exist, unset campaign
    campaign = (campaign !== '_|_|_|_|_') ? campaign : null;
  }

  // Finally fallback to google click link tracking
  if (!campaign) {
    campaign = queryParams.gclid;
  }

  return campaign;
};
