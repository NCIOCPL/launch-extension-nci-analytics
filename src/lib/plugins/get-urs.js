'use strict';

var cookie = require('@adobe/reactor-cookie');
var document = require('@adobe/reactor-document');
var window = require('@adobe/reactor-window');

// Define the defaults for URS
var config = {
  campaignPrefixDelimiter: '_',

  // referring url categories
  internalDomains: ['cancer.gov', 'nci.nih.gov', 'smokefree.gov'],
  searchEngines: [
    'alibaba.com',
    'aol.',
    'ask.com',
    'baidu.com',
    'bing.com',
    'duckduckgo.com',
    'google.',
    'msn.com',
    'search.yahoo.',
    'yandex.'
  ],
  socialNetworks: [
    'facebook.com',
    'flickr.com',
    'instagram.com',
    'linkedin.com',
    'pinterest.com',
    'plus.google.com',
    'reddit.com',
    't.co',
    'tumblr.com',
    'twitter.com',
    'yelp.com',
    'youtube.com'
  ],
  govDomains: ['.gov'], // specific gov domains; change to '.gov' to include all gov domains
  eduDomains: ['.edu'], // specific edu domains; change to '.edu' to include all edu domains

  // cid/tracking code patterns for channel recogniation
  pattEmail: /^(e(b|m)_)|((eblast|email)\|)/i,
  pattPaidSocial: /^psoc_/i,
  pattSocial: /^((soc|tw|fb)_|(twitter|facebook)\||sf\d{8}$)/i,
  pattSem: /^(sem|ppc)_/i,
  pattAffiliate: /^aff_/i,
  pattPartner: /^ptnr_/i,
  pattDisplay: /^bn_/i,
  pattDr: /^dr_/i, // direct response
  pattInternal: /^int_/i,

  // channel stacking (cross visit participation)
  channelStackDepth: 5,
  channelStackDelimiter: '>',
  channelStackExpire: 180, // cookie expiration days
  channelStackCookie: 'nci_urs_stack' // name of channel stack cookie
};

// TODO: Rewrite this using turbine's query string functions
/**
 * get any value from the query string
 * @param pvQueryParam {string} - accepts multiple comma-delimited param names; will return value of first param found
 * @param pvUrl {string=} - if NOT provided, defaults to current page url/address;
 */
function getQueryString(pvQueryParam, pvUrl) {
  var returnVal = '';
  var fullSubString;

  fullSubString = pvUrl
    ? pvUrl.slice(pvUrl.indexOf('?') + 1)
    : window.location.search.substring(1);

  var subStringArray = fullSubString.split('&');
  var queryParamArray = pvQueryParam.split(',');

  if (subStringArray.length > 0) {
    for (var i = 0, maxi = subStringArray.length; i < maxi; i++) {
      // loop through params in query string
      var paramValue = subStringArray[i].split('=');
      for (var ii = 0, maxii = queryParamArray.length; ii < maxii; ii++) {
        // loop through params in pvQueryParam
        if (paramValue[0].toLowerCase() === queryParamArray[ii].toLowerCase()) {
          returnVal = paramValue[1] ? unescape(paramValue[1]) : '';
          returnVal = returnVal.replace(/\+/g, ' '); // replace '+' with ' '
          returnVal = returnVal.replace(/^\s+|\s+$/g, ''); // trim trailing and leading spaces from string
          return returnVal;
        }
      }
    }
  }
  return returnVal;
}

/**
 * determine if variable is null, undefined or blank ('')
 * @param variable {string}
 * @author Evolytics <nci@evolytics.com>
 * @since 2017-04-28
 * @returns {Boolean}
 */
function isVarEmpty(variable) {
  if (variable === null || typeof variable === 'undefined' || variable === '') {
    return true;
  }
  return false;
}

/**
 * build channel stack cookie for cross-visit participation
 * @param payload {object}
 * @param payload.cookieName {string} - cookie name
 * @param payload.cookieValue {string} - value to add to cookie
 * @param payload.returnLength {number} - number of items to stack
 * @param payload.delimiter {string} - delimiter for stacked values
 * @param payload.expire {number} - number of days until cookie expires
 */
function crossVisitParticipation(payload) {
  var cookieValue = payload.cookieValue
    ? payload.cookieValue.replace('\'', '')
    : '';
  var cookieArray = cookie.get(payload.cookieName)
    ? cookie.get(payload.cookieName).split(',')
    : '';
  var expireDate = payload.expire;
  var returnValue;

  if (cookieValue) {
    if (cookieArray === 'none' || isVarEmpty(cookieArray)) {
      // does the cookie exist, with data?
      var newCookieArray = [cookieValue]; // build the new array with payload.cookieValue
      cookie.set(payload.cookieName, newCookieArray, { expires: expireDate }); // create the new cookie
      return cookieValue; // return new string
    }

    var mostRecent = cookieArray[0];
    if (mostRecent !== cookieValue) {
    // is the current payload.cookieValue same as last?
      cookieArray.unshift(cookieValue); // if not, add it
      if (cookieArray.length >= payload.returnLength) {
        cookieArray.length = payload.returnLength;
      } // make sure array length matches payload.returnLength
      cookie.set(payload.cookieName, cookieArray, { expires: expireDate }); // update the cookie with new values
    }
  }
  returnValue = cookieArray
    ? cookieArray.reverse().join(payload.delimiter)
    : ''; // build the return string using payload.delimiter
  return returnValue;
}

/**
 * @description retieves list of # most recent marketing channel sources for visitor
 * @param payload {object}
 * @param payload.channel {string}
 * @param payload.ursCookie {string}
 * @author Evolytics <nci@evolytics.com>
 * @since 2017-04-28
 * @returns {object}
 */
function getStacked(payload) {
  var ursCookie = payload.ursCookie;
  var channel = payload.channel;
  var returnValue = '';

  if (channel) {
    returnValue = crossVisitParticipation({
      cookieName: ursCookie,
      cookieValue: channel,
      returnLength: config.channelStackDepth,
      delimiter: config.channelStackDelimiter,
      expire: config.channelStackExpire
    });
  }

  return returnValue;
}

/**
 * returns the tracking code (channel) prefix for use with channel stacking
 * @author Evolytics <nci@evolytics.com>
 * @since 2017-04-28
 * @param campaign {string=} - tracking code (cid, utm_, etc.)
 * @param delimiter {string=} - character separating tracking code prefix from rest of string
 * @returns {string}
 */
function getPrefix(campaign, delimiter) {
  var returnValue = '';
  if (campaign) {
    returnValue = campaign.split(delimiter || '_')[0];
  }
  return returnValue;
}

/**
 * @param refDomain {string} - referring domain (hostname)
 * @param referrer {string} - full referring url
 * @param searchEngines {array} - array of known search engines
 */
function getSeoStatus(refDomain, searchEngines, referrer) {
  var isSeo = false;
  var isGoogle = referrer.indexOf('.google.') > -1 ? true : false;
  var isYahoo = referrer.indexOf('search.yahoo.com') > -1 ? true : false;
  var isYandex = referrer.indexOf('.yandex.') > -1 ? true : false;

  if (isGoogle || isYahoo || isYandex) {
    isSeo = true;
  } else if (referrer && searchEngines.indexOf(refDomain) > -1) {
    isSeo = true;
  }

  return isSeo;
}

/**
 * urs logic
 * @param payload {object}
 * @param payload.campaign {string=} - tracking code
 * @param payload.referrer {string=} - referring url
 * @author Evolytics <nci@evolytics.com>
 * @since 2017-04-28
 * @returns {object}
 * @example getUrs({ campaign: 'ppc_sample_tracking_code', 'https://www.google.com/' });
 */
var getUrs = function (payload) {
  var trafficType = '';
  var ursValue = '';
  var ursPrefix = '';
  var ppcKeyword = '';
  var seoKeyword = '';
  var refDomain = '';
  var refSubDomain = '';
  var campaign = payload.campaign ? payload.campaign : '';
  var documentReferrer = document.referrer ? document.referrer : '';
  var referrer = payload.referrer ? payload.referrer : documentReferrer;

  // extract referring domain from referrer; exclude subdomain/cname
  var refInfo = (function () {
    var info = {
      domain: '',
      subDomain: '',
      tld: ''
    };
    if (referrer) {
      info.domain = referrer.split('/')[2].split('.'); // get hostname from referring url
      info.subDomain = info.domain.join('.'); // full domain, including subdomain/cname
      info.domain =
        info.domain.length > 2
          ? info.domain.slice(1, info.domain.length)
          : info.domain;
      info.tld = info.domain[info.domain.length - 1];
      info.domain = info.domain.join('.'); // strip subdomain/cname from hostname
    }
    return info;
  })();

  var tld = refInfo.tld;
  refDomain = refInfo.domain;
  refSubDomain = refInfo.subDomain;

  // determine marketing channel based on business rules and regex patterns set in config
  if (!campaign && !referrer && !refDomain) {
    trafficType = 'direct-dnt';
    ursValue = campaign;
  } else if (campaign.search(config.pattDisplay) > -1) {
    trafficType = 'display';
    ursValue = campaign;
  } else if (campaign.search(config.pattAffiliate) > -1) {
    trafficType = 'affiliate';
    ursValue = campaign;
  } else if (campaign.search(config.pattPartner) > -1) {
    trafficType = 'partner';
    ursValue = campaign;
  } else if (campaign.search(config.pattDr) > -1) {
    trafficType = 'dr';
    ursValue = campaign;
  } else if (campaign.search(config.pattEmail) > -1) {
    trafficType = 'email';
    ursValue = campaign;

    // account for non-compliant tracking code schema
    if (/^eblast\|/i.test(campaign)) {
      config.campaignPrefixDelimiter = '|';
    }
  } else if (campaign.search(config.pattSocial) > -1) {
    trafficType = 'social';
    ursValue = campaign;
  } else if (campaign.search(config.pattPaidSocial) > -1) {
    trafficType = 'paid_social';
    ursValue = campaign;
  } else if (campaign.search(config.pattSem) > -1) {
    trafficType = 'paid_search';
    ursValue = campaign;

    // look for paid search keyword
    if (referrer) {
      ppcKeyword = getQueryString('q,query,search', referrer);
    }
    ppcKeyword = ppcKeyword
      ? ppcKeyword
      : 'not provided|' + (refDomain ? refDomain : trafficType);

    // internal tracking code
  } else if (campaign.search(config.pattInternal) > -1) {
    trafficType = 'internal';
    ursValue = campaign;

    // unknown/unrecognized tracking code prefix
  } else if (campaign) {
    // catch campaigns with unexpected or unknown prefix
    trafficType = 'unknown';
    ursValue = campaign;

    // internal domains (do not track as referrer/channel)
  } else if (
    referrer &&
    (config.internalDomains.indexOf(refDomain) > -1 ||
      config.internalDomains.indexOf(refSubDomain) > -1)
  ) {
    trafficType = 'internal-dnt';
    ursValue = '';

    // known social -- include before [seo] because of 'plus.google.com'
  } else if (
    (referrer && config.socialNetworks.indexOf(refDomain) > -1) ||
    refSubDomain === 'plus.google.com'
  ) {
    trafficType = 'social';
    ursValue = '[soc]_' + refDomain;

    // known seo
  } else if (getSeoStatus(refDomain, config.searchEngines, referrer)) {
    trafficType = 'organic_search';
    ursValue = '[seo]_' + refDomain;

    // look for seo keyword
    seoKeyword = getQueryString('q,query,search,text', referrer);
    seoKeyword = seoKeyword
      ? seoKeyword
      : 'not provided|' + (refDomain ? refDomain : trafficType);

    // known government domains
  } else if (
    referrer &&
    tld === 'gov' &&
    config.internalDomains.indexOf(refDomain) < 0
  ) {
    trafficType = 'government_domains';
    ursValue = '[gov]_' + refDomain;

    // known education domains
  } else if (referrer && tld === 'edu') {
    trafficType = 'education_domains';
    ursValue = '[edu]_' + refDomain;

    // unknown referring domains
  } else if (referrer && config.govDomains.indexOf(refDomain) < 0) {
    trafficType = 'referring_domains';
    ursValue = '[ref]_' + refDomain;
  }

  ursPrefix = getPrefix(ursValue, config.campaignPrefixDelimiter);

  // if campaign has an unknown prefix (identified above), set trafficType to match ursPrefix
  if (trafficType === 'unknown') {
    trafficType = ursPrefix;
  }

  if (ursValue !== '' && trafficType !== 'organic_search') {
    seoKeyword = 'not organic search';
  }

  if (ursValue !== '' && trafficType !== 'paid_search') {
    ppcKeyword = 'not paid search';
  }

  // return urs information for use in analytics calls
  return {
    campaign: campaign,
    referrer: referrer,
    refDomain: refDomain,
    value: ursValue,
    prefix: ursPrefix,
    stacked: getStacked({
      channel: ursPrefix,
      ursCookie: config.channelStackCookie
    }),
    trafficType: trafficType,
    seoKeyword: seoKeyword,
    ppcKeyword: ppcKeyword
  };
};

module.exports = getUrs;
