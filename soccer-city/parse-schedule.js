const _ = require('lodash');
const XLSX = require('xlsx');

const schedule = {
  season: '',
  leagues: [],
  divisions: [],
  teams: [],
  games: []
};

const temp = {
  teams: [],  // {NAME, COLORS, LEAGUE, COL, ROW}
  leagues: [], // {NAME. COL, ROW}
  dates: [], // {DATE, COL, ROW}
  fields: [], // {FIELD, COL, ROW}
  games: []
};

module.exports = function parseSchedule (fileName) {
  try {
    const workbook = XLSX.readFile(fileName);
    let sheetName = workbook.SheetNames[0];
    let worksheet = workbook.Sheets[sheetName];
    let range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        let cellAddress = String.fromCharCode(65 + col) + (row + 1);
        let cell = worksheet[cellAddress];
        if (cell) {
          cell.address = cellAddress;
          parseCell(cell);
        }
      }
    }

    temp.teams.forEach((team) => {
      schedule.teams.push({
        name: team.name,
        league: team.league,
        colors: team.colors
      });
    });
    return schedule;
  } catch (error) {
    console.error(error);
  }
};

function parseCell (cell) {
  return isSeason(cell) || isLeague(cell) || isTeam(cell) || isDate(cell) || isField(cell) || isGameTime(cell) || isGameFixture(cell);
}

function isSeason (cell) {
  const seasonRegExp = /^(winter|spring|summer|fall)\s\d\s\d{4}/i;
  // check if it is the season
  if (cell.t === 's' && seasonRegExp.test(cell.v.trim())) {
    schedule.season = cell.v.trim();
    return 'SEASON';
  }
}

function isLeague (cell) {
  const leagueRegExp = /^(?!(\d+\.)|(\s)).*\s-\s.*/g;
  if (leagueRegExp.test(cell.v)) {
    let leagueName = cell.v.substring(0, cell.v.indexOf(' - '));
    let divisionName = cell.v.substring(cell.v.indexOf(' - ') + 3);

    let league = {
      name: cell.v,
      col: cell.address.charCodeAt(0) - 64,
      row: parseInt(cell.address.substring(1), 10)
    };
    temp.leagues.push(league);
    if (!schedule.leagues.includes(leagueName)) {
      schedule.leagues.push(leagueName);
    }
    if (!schedule.divisions.find(division => division.league === leagueName && division.name === divisionName)) {
      schedule.divisions.push({
        league: leagueName,
        name: divisionName
      });
    }
    return 'LEAGUE';
  }
}

function isTeam (cell) {
  let teamRegExp = /^\d+\.\s.*\s-\s.*/g;
  if (teamRegExp.test(cell.v)) {
    let team = {
      id: cell.v.substring(0, cell.v.indexOf('.')),
      name: cell.v.substring(cell.v.indexOf('. ') + 2, cell.v.indexOf(' - ')),
      colors: [],
      col: cell.address.charCodeAt(0) - 64,
      row: parseInt(cell.address.substring(1), 10)
    };
    let colors = cell.v.substring(cell.v.indexOf(' - ') + 2).split('/');
    colors.forEach((color) => {
      if (color.trim() === 'Blk') color = 'Black';
      else if (color.trim() === 'Grey') color = 'Gray';
      team.colors.push(color.trim());
    });
    let nearest = null;
    temp.leagues.forEach((league) => {
      if (team.col === league.col && team.row > league.row) {
        nearest = league;
      }
    });
    if (nearest) team.league = nearest.name;
    temp.teams.push(team);
    return 'TEAM';
  }
}

function isDate (cell) {
  if (cell.t === 'n') { // Check if it is a date
    let date = {
      date: ExcelDateToJSDate(cell.v),
      col: cell.address.charCodeAt(0) - 64,
      row: parseInt(cell.address.substring(1), 10)
    };
    temp.dates.push(date);
    return 'GAME-DATE';
  }
}

/*
  http://stackoverflow.com/questions/16229494/converting-excel-date-serial-number-to-date-using-javascript
*/
function ExcelDateToJSDate (serial) {
  var utc_days  = Math.floor(serial - 25569);
  var utc_value = utc_days * 86400;
  var date_info = new Date(utc_value * 1000);
  var fractional_day = serial - Math.floor(serial) + 0.0000001;

  var total_seconds = Math.floor(86400 * fractional_day);

  var seconds = total_seconds % 60;

  total_seconds -= seconds;

  var hours = Math.floor(total_seconds / (60 * 60));
  var minutes = Math.floor(total_seconds / 60) % 60;

  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate() + 1, hours, minutes, seconds);
}

function isField (cell) {
  let fieldRegExp = /^(Field A|Field B|Field C|Field D|Rivers Edge)/g;
  if (fieldRegExp.test(cell.v)) {
    let field = {
      field: cell.v,
      col: cell.address.charCodeAt(0) - 64,
      row: parseInt(cell.address.substring(1), 10)
    };
    temp.fields.push(field);
    return 'GAME-FIELD';
  }
}

function isGameTime (cell) {
  let timeRegExp = /^\d+:\d+$/g;
  if (cell.t === 's' && cell.v.match(timeRegExp)) { // Check if it is a game (time)
    let game = {
      col: cell.address.charCodeAt(0) - 64,
      row: parseInt(cell.address.substring(1), 10)
    };

    let hours = parseInt(cell.v.substring(0, cell.v.indexOf(':')), 10) + 12;
    let minutes = cell.v.substring(cell.v.indexOf(':') + 1);

    // Check what date the time is for
    temp.dates.forEach((date) => {
      if (game.col === date.col && game.row > date.row) {
        game.time = new Date(date.date.getFullYear(), date.date.getMonth(), date.date.getDate(), hours, minutes);
      }
    });

    // Check what field the time is for
    temp.fields.forEach((field) => {
      if ((game.col === field.col || game.col + 1 === field.col) && game.row > field.row) {
        game.field = field.field;
      }
    });

    temp.games.push(game);
    return 'GAME-TIME';
  }
}

function isGameFixture (cell) {
  let gameRegExp = /^\d+\sv\s\d+$/g;
  if (gameRegExp.test(cell.v)) { // Check who is playing the game
    let col = cell.address.charCodeAt(0) - 64;
    let row = parseInt(cell.address.substring(1), 10);

    let home = cell.v.substring(0, cell.v.indexOf(' v '));
    let away = cell.v.substring(cell.v.indexOf(' v ') + 3);

    temp.games.forEach((game) => {
      if (col - 1 === game.col && row === game.row) {
        temp.teams.forEach((team) => {
          if (home === team.id) {
            home = team.name;
          } else if (away === team.id) {
            away = team.name;
          }
        });

        let obj = {
          time: game.time,
          field: game.field,
          home: home,
          away: away
        };

        schedule.games.push(obj);
      }
    });
    return 'GAME-TEAMS';
  }
}
