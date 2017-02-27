'use strict';

var SL = require('sl-api');
var moment = require('moment-timezone');
var fs = require('fs');
 
var sl = null;

var TIMEZONE = 'Europe/Stockholm'; 

var realtimeInformationKeys = require('./keys')


function getTime(siteId, type, line, direction, callback){
    sl.realtimeInformation({siteId: siteId, timeWindow: 60})
    .then((data)=>{
        var results = data[type].filter((data)=>{
            return data.LineNumber == line && data.JourneyDirection == direction;
        }).map((result)=>{
          try{
            var date = null;
            if(result.ExpectedDateTime === undefined){
                date = moment.tz(data.LatestUpdate,TIMEZONE).add(parseInt(result.DisplayTime),'m')
            } else {
                date = moment.tz(result.ExpectedDateTime,TIMEZONE)
            }
            return {in: result.DisplayTime, at: date.format(), from: moment.tz(data.LatestUpdate,TIMEZONE).format() };
          }catch(e) {
            console.error(e.stack);
          }
        });
        callback(results);
    })
    .fail(function(result){
        callback(result);
    })
    .done();
}

var main = function() {
  var time = moment().tz(TIMEZONE);
  var interval = 3;
  if(time.hour() >= 1 && time.hour() <= 4){
    interval = 5;
  }
  if(time.hour() >= 6 && time.hour() <= 20 ){
    interval = 2;

  }

  if((time.minute() % interval) == 0) {
    var keyId = Math.round((time.minute() / interval)) % realtimeInformationKeys.length;
    sl = new SL({
      realtimeInformation: realtimeInformationKeys[keyId],
    });
    getTime(3463,'Buses','67',1,function(data){
      console.log('Getting new data', data, realtimeInformationKeys[keyId]);
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