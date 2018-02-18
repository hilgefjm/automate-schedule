const fs = require('fs');

let configOverrides;
try {
  configOverrides = require('./config.json');
} catch (fileDoesNotExist) {
  // Do nothing
}

const config = {
  MY_TEAMS: []
};

if (configOverrides) {
  Object.assign(config, configOverrides);
}

module.exports.myTeams = config.MY_TEAMS;
module.exports.updateSyncTime = function updateSyncTime ({ league, team, lastSynced }) {
  if (configOverrides) {
    config.MY_TEAMS.forEach(myTeam => {
      if (myTeam.league === league && myTeam.name === team) {
        myTeam.lastSynced = lastSynced;
      }
    });
    fs.writeFileSync('config.json', JSON.stringify(config), 'utf8');
  }
};
