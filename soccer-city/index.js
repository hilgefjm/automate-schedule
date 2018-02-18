const cheerio = require('cheerio');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const url = require('url');
const debug = require('debug')('automate-schedule');
const request = require('request-promise');
const parseSchedule = require('./parse-schedule');

const APP_DATA_DIR = path.join(os.tmpdir(), 'soccer-parser');

const organizations = [
  {name: 'Soccer City'},
  { name: 'Rivers Edge'}
];

const facilities = [
  {name: 'Soccer City', address: '5770 Springdale Road', city: 'Cincinnati', state: 'OH', country: 'US', postalCode: '45247', phone: '5137418480', organization: 'Soccer City'},
  {name: 'Rivers Edge', address: '5255 OH-128', city: 'Cincinnati', state:'OH', country: 'US', postalCode: '45002', phone: '5132641775', organization: 'Rivers Edge'}
];

const fields = [
  {name: 'Field A', facility: 'Soccer City'},
  {name: 'Field B', facility: 'Soccer City'},
  {name: 'Field C', facility: 'Soccer City'},
  {name: 'Field D', facility: 'Soccer City'},
  {name: 'Rivers Edge', facility: 'Rivers Edge'}
];

module.exports.fetchLeagueInformormation = async function fetchLeagueInformormation (url) {
  try {
    const html = await request(url);
    return parseLeagues(html);
  } catch(error) {
    console.error(error);
  }
};

/*
  http://www.indoorsoccercity.com/information/schedules
  Website format is:
  leagueName             excelLink   pdfLink   lastUpdateDate
  _____________________________________________________________________
  Adult Soccer             Excel      PDF
  Coed 25/30/35 (Fri/Sat)   <a>       <a>       updated: 01/26 04:18PM
  Coed Open (Sunday)        <a>       <a>       updated: 02/06 03:58PM
  ...
  Youth Soccer
  ...
  _____________________________________________________________________
*/
function parseLeagues (html) {
  const leagues = [];
  const $ = cheerio.load(html);
  $('tr', '.scheduleListTable').each((i, tr) => {
    const td = $(tr).children('td');
    if (td.length > 0) {
      try {
        let league = {
          name: td.get(0).children[0].data,
          excel: `http://www.indoorsoccercity.com${td.get(1).children[0].attribs.href}`,
          pdf: `http://www.indoorsoccercity.com${td.get(2).children[0].attribs.href}`,
          lastUpdated: parseDate(td.get(3).children[0].data)
        };
        leagues.push(league);
      } catch (error) {
        console.log(error);
      }
    }
  });
  return leagues;
}

/*
  Date is format:
    updated: 02/06 03:58PM
*/
function parseDate (dateString) {
  dateString = dateString.replace('updated: ','');
  let year = (new Date()).getFullYear();

  // We need to subtract 1 from month due to Date constructor
  let month = dateString.substring(0, dateString.indexOf('/')) - 1;

  // If current month < schedule month, schedule is from previous year
  if ((new Date()).getMonth() + 1 < month) year = year - 1;

  let day = dateString.substring(dateString.indexOf('/') + 1, dateString.indexOf(' '));
  let hour = parseInt(dateString.substring(dateString.indexOf(' ') + 1, dateString.indexOf(':')), 10);
  let minutes = dateString.substring(dateString.indexOf(':') + 1, dateString.indexOf('M') - 1);

  // Convert from 12-hour format
  if (dateString.indexOf('PM') > 0) hour += 12;

  return new Date(year, month, day, hour, minutes);
}

module.exports.downloadSchedule = async function downloadSchedule (leagueInfo) {
  createAppDataDir();
  let fileName = url.parse(leagueInfo.excel).pathname.split('/').pop();
  const filePath = path.join(APP_DATA_DIR, fileName);
  await download(leagueInfo.excel, filePath);
  const schedule = parseSchedule(filePath);
  Object.assign(schedule, { organizations, facilities, fields });
  saveSchedule(schedule, filePath.replace(path.extname(fileName), '.json'));
  return schedule;
};

function createAppDataDir () {
  if (!fs.existsSync(APP_DATA_DIR)) {
    fs.mkdirSync(APP_DATA_DIR, '777');
  }
}

function saveSchedule (schedule, filePath) {
  fs.writeFileSync(filePath, JSON.stringify(schedule));
}

async function download (link, saveToPath) {
  let options = {
    host: url.parse(link).host,
    port: 80,
    path: url.parse(link).pathname
  };

  fs.closeSync(fs.openSync(saveToPath, 'w'));
  var file = fs.createWriteStream(saveToPath);

  return new Promise(resolve => {
    http.get(options, (response) => {
      response.on('data', (data) => {
        // console.log(data);
        file.write(data);
      }).on('end', () => {
        file.end();
        file.close();
        debug(`${saveToPath} downloaded.`);
        resolve();
      });
    });
  });
}
