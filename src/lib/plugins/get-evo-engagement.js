'use strict';

/*
 * Plugin: custom engagement tracking.
 * NOTE: This was reconstituted from minified code, so some vars may be odd.
 */

var cookie = require('@adobe/reactor-cookie');
var document = require('@adobe/reactor-document');
var window = require('@adobe/reactor-window');

/**
 * Attach Events helper function for EvoEngagementPlugin
 * @param payload {object}
 * @param payload.element {object} - the element to attach the event to
 * @param payload.event {string} - the event name
 * @param payload.action {string} - the callback function
 */
function attachEvents(payload) {
  var element = payload.element;
  var event = payload.event;
  var action = payload.action;

  if (element.addEventListener) {
    element.addEventListener(event, action);
  } else if (element.attachEvent) {
    element.attachEvent('on' + event, action);
  }
}

// Constant to define the name of the engagement object on
// the window.
var engagementObjectName = 'NCIEngagement';

// Move this to a plugin setting, for now allow us to set a
// cookie to enable it.
var verboseDebugging = cookie.get('nci_evo_verbose') === 'true';

/**
 * Log a message
 * @param {string} message - The message.
 */
function logVerbose(message) {
  var date = new Date();
  var time = [ date.getHours(), date.getMinutes(), date.getSeconds() ].join(':');
  verboseDebugging && turbine.logger.info('[' + engagementObjectName + '] (' + time + ') ' + message);
}

/**
 * Initializes the EvoEngagement object
 */
function initializeEvoEngagement() {
  var engagementObject = {
    pollingInterval: 1e4,
    scorePerInterval: 10,
    hasScrolled: false,
    hasMoused: false,
    hasClicked: false,
    defaultEngagementScore: 0,
    engagementScore: 0,
    minimumEngagementScore: 1,
    cookieName: 'engagementTracking',
    initialize: function () {
      turbine.logger.info(engagementObjectName + ' initialize');
      this.startTime = new Date().getTime();
      this.isFocused = document.hasFocus();
    },
    doScroll: function () {
      this.isFocused = document.hasFocus();
      if (this.isFocused) {
        logVerbose('doScroll');
        this.hasScrolled = true;
      }
    },
    doMouse: function () {
      this.isFocused = document.hasFocus();
      if (this.isFocused) {
        logVerbose('doMouse');
        this.hasMoused = true;
      }
    },
    doClick: function () {
      this.isFocused = document.hasFocus();
      if (this.isFocused) {
        logVerbose('doClick');
        this.hasClicked = true;
      }
    },
    getEngagementScore: function (eng) {
      var newScore = eng.status ? eng.score + 10 : eng.score;
      this[eng.action] = false;
      return newScore;
    },
    getEngagementStatus: function () {
      this.engagementScore = this.getEngagementScore({
        action: 'hasScrolled',
        status: this.hasScrolled,
        score: this.engagementScore
      });
      this.engagementScore = this.getEngagementScore({
        action: 'hasMoused',
        status: this.hasMoused,
        score: this.engagementScore
      });
      this.engagementScore = this.getEngagementScore({
        action: 'hasClicked',
        status: this.hasClicked,
        score: this.engagementScore
      });
      this.status = { engagementScore: this.engagementScore };
      return this.status;
    },
    setEngagementCookie: function (score) {
      cookie.set(this.cookieName, score);
    },
    getAndResetEngagementCookie: function () {
      logVerbose('Get and Reset Cookie');
      var val = cookie.get(this.cookieName) || '';
      this.setEngagementCookie('0');
      return val;
    }
  };

  engagementObject.initialize();

  // Setup a timer to check for engagement.
  // formerly known as engagement_timer before the linter complained.
  setInterval(
    function () {
      engagementObject.getEngagementStatus();
      var isEngaged = engagementObject.engagementScore >= engagementObject.minimumEngagementScore;
      var accumulatedScore = cookie.get(engagementObject.cookieName) || 0;

      if (isEngaged) {
        var newAccumulatedScore = parseInt(accumulatedScore, 10) + engagementObject.scorePerInterval;
        engagementObject.setEngagementCookie(newAccumulatedScore);
        logVerbose(' Old Accumulated Score: ' + accumulatedScore + ' New Accumulated Score: ' + newAccumulatedScore);
        engagementObject.engagementScore = engagementObject.defaultEngagementScore;
      } else {
        logVerbose(' Old Accumulated Score: ' + accumulatedScore + ' New Accumulated Score: NO CHANGE');
      }
    },
    engagementObject.pollingInterval
  );

  attachEvents({
    element: window,
    event: 'scroll',
    action: function () {
      engagementObject.doScroll();
    }
  });

  attachEvents({
    element: window,
    event: 'mouseover',
    action: function () {
      engagementObject.doMouse();
    }
  });
  attachEvents({
    element: window,
    event: 'click',
    action: function () {
      engagementObject.doClick();
    }
  });

  return engagementObject;
}

// Function to return an instance of the engagement object.
module.exports = function () {
  var engagementObject = initializeEvoEngagement();
  // Technically we do not need to set the object onto the
  // window here. We will do this in order to debug, and
  // avoid any legacy code surprises that were looking for
  // the object directly.
  window[engagementObjectName] = engagementObject;
  return function() { return engagementObject; };
};
