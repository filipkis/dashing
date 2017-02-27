'use strict';

var SL = require('sl-api');
var moment = require('moment-timezone');
var fs = require('fs');
var request = require('request');
 
var TIMEZONE = 'Europe/Stockholm'; 
var slAPIKeys = require('./keys')

var sl = null;
var slResRobotApi = `https://api.resrobot.se/v2/departureBoard?format=json&key=${slAPIKeys.resRobot}&id=740045586`


function getTime(siteId, type, line, direction, callback){
    sl.realtimeInformation({siteId: siteId, timeWindow: 60})
    .then((data)=>{
        // Get real time departures
        var results = data[type].filter((data)=>{
            return data.LineNumber == line && data.JourneyDirection == direction;
        }).map((result)=>{
          var date = null;
          if(result.ExpectedDateTime === undefined){
              date = moment.tz(data.LatestUpdate,TIMEZONE).add(parseInt(result.DisplayTime),'m')
          } else {
              date = moment.tz(result.ExpectedDateTime,TIMEZONE)
          }
          return {in: result.DisplayTime, at: date.format(), from: moment.tz(data.LatestUpdate,TIMEZONE).format() };
        });

        // If less then 3 results get future timetable departures
        if( results.length < 3) {
          var time = moment().tz(TIMEZONE).add('60', 'm')
          request(slResRobotApi + `&time=${time.format('HH:mm')}`, (error, response, body)=>{
            console.log('Gotten here')
            if (!error && response.statusCode == 200) {
              var data = JSON.parse(body);
              results = results.concat(data.Departure.filter((d)=>{
                return d.direction.indexOf('Stockholm') !== -1;
              }).map((result)=>{
                var date = moment(result.date + ' ' + result.time + '+01:00').tz(TIMEZONE);
                return {at: date.format()}
              }));
              callback(results)
            } else {
              console.error(error, body);
            }
          })
        } else {
          callback(results);
        }
    })
    .fail(function(result){
      console.error(result)
      callback();
    })
    .done();
}

var main = function() {
  var time = moment().tz(TIMEZONE);
  var interval = 3;
  if(time.hour() >= 1 && time.hour() <= 4){
    // interval = 5;
    return; //TODO: when metro is added this should not exit
  }
  if(time.hour() >= 6 && time.hour() <= 20 ){
    interval = 2;

  }

  if((time.minute() % interval) == 0) {
    var keyId = Math.round((time.minute() / interval)) % slAPIKeys.realtimeInformation.length;
    sl = new SL({
      realtimeInformation: slAPIKeys.realtimeInformation[keyId],
    });
    getTime(3463,'Buses','67',1,function(data){
      console.log('Getting new data', data);
      fs.writeFile('public/timetable.json',JSON.stringify(data));
    })
  }
}


try{
  main();
  setInterval(main,60000);
  
} catch(e) {
  console.error(e.stack);
}
