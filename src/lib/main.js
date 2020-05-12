'use strict';

var getUrs = require('./plugins/get-urs');
var getCampaignCode = require('./plugins/get-campaign-code');
var getEvoEngagement = require('./plugins/get-evo-engagement');

/*
 * Add our plugin and any required plugins to the tracker
 */
var augmentTracker = turbine.getSharedModule('adobe-analytics', 'augment-tracker');

// Add our plugin to the tracker
augmentTracker(function(s) {
  turbine.logger.info('Augmenting Tracker');
  // Add to doPlugins by saving the original
  if (s) {
    s.getNciCampaignCode = getCampaignCode;
    s.getNciUrs = getUrs;
    // Note: this plugin needs to be executed so that it can initialize itself.
    // The function yields a function to access the engagement object,
    s.getNciEngagement = getEvoEngagement();
  } else {
    turbine.logger.warn('No Analytics tracker found');
  }
});
