const readline = require('readline');
const { myTeams, updateSyncTime } = require('./config');
const { fetchLeagueInformormation, downloadSchedule } = require('./soccer-city');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const affirmativeAnswers = ['Y', 'YES', ''];
const negativeAnswers = ['N', 'NO'];

async function run () {
  // Download schedules
  const leagueInfo = await fetchLeagueInformormation('http://www.indoorsoccercity.com/information/schedules');
  const myLeagueFilter = myTeams.map(team => team.league);
  const myLeagues = leagueInfo.filter(league => myLeagueFilter.includes(league.name));
  for (let myLeaguesIndex = 0; myLeaguesIndex < myLeagues.length; myLeaguesIndex++) {
    const team = myTeams.find(team => team.league === myLeagues[myLeaguesIndex].name);
    const league = {
      ...myLeagues[myLeaguesIndex],
      team: team.name,
      lastSynced: team.lastSynced
    };
    // Only prompt if the league has updated since the last run
    if (new Date(league.lastUpdated).getTime() > new Date(league.lastSynced).getTime()) {
      await promptForScheduleUpdate(league);
    }
  }
  process.exit(0);
}

async function promptForScheduleUpdate (league, preface) {
  const question = `${preface || ''}${league.name} was updated ${league.lastUpdated.toISOString()}. Would you like to sync this update? (Y/N) `;
  const answer = await new Promise(resolve => rl.question(question , resolve));
  if (affirmativeAnswers.includes(answer.toUpperCase())) {
    const schedule = await downloadSchedule(league);
    // updateFcMe(schedule);
    await promptForCalendarUpdate();

    // Update lastSynced in config
    // updateSyncTime({ league: league.name, team: league.team, lastSynced: league.lastUpdated });
  } else if (negativeAnswers.includes(answer.toUpperCase())) {
    console.log(`\nNot updating ${league.name}...`);
    return;
  } else {
    return await promptForScheduleUpdate(league, badResponse(answer));
  }
}

async function promptForCalendarUpdate (preface) {
  const question =`${preface || ''}Would you like to update your Google Calendar too? (Y/N) `;
  const answer = await new Promise(resolve => rl.question(question, resolve));
  if (affirmativeAnswers.includes(answer.toUpperCase())) {
    // await updateCalendar(schedule);
    console.log('Calendar updated');
  } else if (negativeAnswers.includes(answer.toUpperCase())) {
    console.log('Not updating calendar...');
    return;
  } else {
    return await promptForCalendarUpdate(badResponse(answer));
  }
}

function badResponse (response) {
  return `Response ${response} was not understood. `;
}

run();
