let express = require('express');
var favicon = require('serve-favicon');
//To get dev info from json
const fs = require("fs");
//retrieve the .config file
require("dotenv").config()
const cookieParser = require("cookie-parser");
const SmartInterval = require("smartinterval");

const port = 1234;
const app = express();

const rosterModule = require("./rosterMain/rosterModule.js")
// Stores database in app for other APIs to use
const rosterDB     = require("./rosterMain/rosterDatabase.js")
app.rosterdb = rosterDB;

//Log Data
const logDir = './Log/';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
function logData(dataToLog, ...otherArgs){
    const today = new Date();
    const month = today.getMonth() + 1; // months are zero-based
    const day = today.getDate();
    const year = today.getFullYear();
    const hour = today.getHours();
    const min = today.getMinutes();
    const secs = today.getSeconds();
    const milli = today.getMilliseconds();

    const logName = `${logDir}log_${month}-${day}-${year}_.txt`;
    let data = `\n[${month}-${day}-${year}_${hour}:${min}:${secs}:${milli}] ${dataToLog}`
    for(i=0; i<otherArgs.length; i++){
        data += otherArgs[i];
    }
    try {
        fs.appendFileSync(logName, data);
        console.log('The data was appended to file!');
      } catch (err) {
        console.log("Just kidding, no workie: ", err);
      }
}
//Allows application to log data
app.logData = logData

//Tell Express where our static files are
app.use(express.static(__dirname + '/public'));
//Update favicon for all pages
app.use(favicon(__dirname + '/public/blacksheep.png'));

//local roster cache. This will be updated every 30 minutes and added on startup so it will never be empty.
app.rosterJSONData = {};

async function main() {
    
    app.get("/getroster", async (req, res) => {
        res.json(JSON.stringify(app.rosterJSONData));
    });
    app.get("/cycleroster", async (req, res) => {
        app.dataFetcher.cycle();
        res.ok();
    })
    app.get("/changes", async (req, res) => {
        let changesMade = {}
        let changeQuery = await rosterDB.GetDataFromDB("SELECT * FROM Changes");
        if (!changeQuery.Error && changeQuery.Data) {
            for (index in changeQuery.Data) {
                let changeItem = changeQuery.Data[index];
                let changeType = changeItem.ChangeType;
                let rng = changeItem.TroopDateRange
                let hrShift = changeItem.HourShift;
                let shiftDate = changeItem.TroopDate;
                let oldroomK = changeItem.OldValueKey;
                let newroomK = changeItem.NewValueKey;
                let oldVal = changeItem.OldValue;
                let newVal = changeItem.NewValue;

                //Converts time stored in the DB from UTC to local time
                const utcDate = new Date(changeItem.EditedOn + "Z");
                const hourOffset = -4; // Example: for EDT (Eastern Daylight Time), which is UTC-4, but if you want to add an hour to the local time, you would adjust this value. For example, if you want to see the time as if it were one hour *later* in local time, and your local time is UTC-4, you would use -3 (effectively UTC-4 + 1 hour).
                utcDate.setHours(utcDate.getHours() + hourOffset);
                const options = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false // Use 24-hour format
                };
                const localTimeString = utcDate.toLocaleString('en-US', options)
                let dateTimeChangeSaved = localTimeString;

                if (changesMade[rng] == undefined) {
                    changesMade[rng] = {}
                }
                if (changesMade[rng][shiftDate] == undefined) {
                    changesMade[rng][shiftDate] = {}
                }
                if (changesMade[rng][shiftDate][hrShift] == undefined) {
                    changesMade[rng][shiftDate][hrShift] = {}
                }
                if (oldroomK !== undefined && changesMade[rng][shiftDate][hrShift][oldroomK] == undefined) {
                    changesMade[rng][shiftDate][hrShift][oldroomK] = []
                }
                if (newroomK !== undefined && changesMade[rng][shiftDate][hrShift][newroomK] == undefined) {
                    changesMade[rng][shiftDate][hrShift][newroomK] = []
                }

                if (oldroomK !== undefined && oldroomK !== null && oldroomK !== "null"){
                    changesMade[rng][shiftDate][hrShift][oldroomK].push({operation: changeType, old: oldVal, new: newVal, dateAndTime: dateTimeChangeSaved})
                }
                if(newroomK !== undefined && newroomK !== null && newroomK !== "null"){
                    changesMade[rng][shiftDate][hrShift][newroomK].push({operation: changeType, old: oldVal, new: newVal, dateAndTime: dateTimeChangeSaved})
                }
            }
        }
        res.json(JSON.stringify(changesMade))
    })
    app.set('view engine', 'ejs');
    // return main page
    app.get("/:name?", async (req, res) => {
        const name = req.params.name;
        var dataFilteredByName = {};
        var shiftHours = [];
        var foundUser = false;
        if (name !== undefined && name !== "" && name !== null) {
            const shiftsForUser = await rosterDB.GetShiftsForTroop(name);
            if (!shiftsForUser.Error && shiftsForUser.Data) {
                foundUser = true;
                const shiftData = shiftsForUser.Data;
                for (index in shiftData) {
                    let shift = shiftData[index];
                    let roomNum = shift.ROOM;
                    shiftHours.push(shift.HOUR);
                    if (dataFilteredByName[shift.DayRange] == undefined) {
                        dataFilteredByName[shift.DayRange] = {};
                    }
                    if (dataFilteredByName[shift.DayRange][shift.Date] == undefined) {
                        dataFilteredByName[shift.DayRange][shift.Date] = {};
                    }
                    if (dataFilteredByName[shift.DayRange][shift.Date][shift.HOUR] == undefined) {
                        dataFilteredByName[shift.DayRange][shift.Date][shift.HOUR] = {};
                    }
                    if (dataFilteredByName[shift.DayRange][shift.Date][shift.HOUR][roomNum] == undefined) {
                        dataFilteredByName[shift.DayRange][shift.Date][shift.HOUR][roomNum] = [];
                    }
                    
                    dataFilteredByName[shift.DayRange][shift.Date][shift.HOUR][roomNum].push({ roomNum, nameInEach: shift.Name })
                } 
            }
        }
        
        let changesMade = {};
        let changeQuery = await rosterDB.GetAllChanges();
        if (!changeQuery.Error && changeQuery.Data) {
            for (index in changeQuery.Data) {
                let changeItem = changeQuery.Data[index];
                let changeType = changeItem.ChangeType;
                let rng = changeItem.TroopDateRange;
                let hrShift = changeItem.HourShift;
                let shiftDate = changeItem.TroopDate;
                let oldroomK = changeItem.OldValueKey;
                let newroomK = changeItem.NewValueKey;
                let oldVal = changeItem.OldValue;
                let newVal = changeItem.NewValue;

                //Converts time stored in the DB from UTC to local time
                const utcDate = new Date(changeItem.EditedOn + "Z");
                const hourOffset = -4; // Example: for EDT (Eastern Daylight Time), which is UTC-4, but if you want to add an hour to the local time, you would adjust this value. For example, if you want to see the time as if it were one hour *later* in local time, and your local time is UTC-4, you would use -3 (effectively UTC-4 + 1 hour).
                utcDate.setHours(utcDate.getHours() + hourOffset);
                const options = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false // Use 24-hour format
                };
                const localTimeString = utcDate.toLocaleString('en-US', options)
                let dateTimeChangeSaved = localTimeString;

                if (changesMade[rng] == undefined) {
                    changesMade[rng] = {}
                }
                if (changesMade[rng][shiftDate] == undefined) {
                    changesMade[rng][shiftDate] = {}
                }
                if (changesMade[rng][shiftDate][hrShift] == undefined) {
                    changesMade[rng][shiftDate][hrShift] = {}
                }
                if (oldroomK !== undefined && changesMade[rng][shiftDate][hrShift][oldroomK] == undefined) {
                    changesMade[rng][shiftDate][hrShift][oldroomK] = []
                }
                if (newroomK !== undefined && changesMade[rng][shiftDate][hrShift][newroomK] == undefined) {
                    changesMade[rng][shiftDate][hrShift][newroomK] = []
                }

                if (oldroomK !== undefined && oldroomK !== null && oldroomK !== "null"){
                    changesMade[rng][shiftDate][hrShift][oldroomK].push({operation: changeType, old: oldVal, new: newVal, dateAndTime: dateTimeChangeSaved})
                }
                if(newroomK !== undefined && newroomK !== null && newroomK !== "null"){
                    changesMade[rng][shiftDate][hrShift][newroomK].push({operation: changeType, old: oldVal, new: newVal, dateAndTime: dateTimeChangeSaved})
                }
                
            }
        }
        
        res.render("cqtime",{
            data: foundUser ? dataFilteredByName : app.rosterJSONData,
            filterNotEmpty: foundUser,
            nameProvided: name !== undefined,
            changes: changesMade,
            shifts: shiftHours,
            name: name
        });
    });
    app.dataFetcher = new SmartInterval(
        async () =>{
            app.rosterJSONData = {};

            //Before getting changes, lets update the saved changes to only last for an hour
            const changesCleanup = await rosterDB.CleanupOldChanges();
            if (!changesCleanup.Error) {
                logData(`[Datafetcher] Deleted ${changesCleanup.Data} outdated changes`)
            }

            //lets get the entire data from the spreadsheets
            let dateIndexes = [];
            let DocSheets = await rosterModule.FetchSheetIDs();
            
            //Leave only the last 3 ranges
            const numOfRangesToKeep = 3
            DocSheets = DocSheets.slice(-( numOfRangesToKeep))

            for (index in DocSheets) {
                let sheetItem = DocSheets[index]
                let sheetID = sheetItem[0]
                let sheetName = sheetItem[1]
                if (sheetName !== "Cleaning Task") {
                    const updatedJSON = await rosterModule.FetchSheetJSON(sheetID)
                    let Dates = Object.keys(updatedJSON);
                    for (index in Dates) {
                        const dateFromJSON = Dates[index]
                        dateIndexes.push(dateFromJSON)
                        //We basically place the returned JSON data into a local variable for easy access by the APIs
                        const jsonData = updatedJSON[dateFromJSON]
                        app.rosterJSONData[dateFromJSON] = jsonData
                    }
                }
            }
        },
        30 * 60 * 1000
    );
    
    app.listen(port, () => {
        logData("Server Listening on PORT:", port);
        app.dataFetcher.start();
        
    });
}
main().catch(console.error);
process.on( 'SIGINT', function() {
	logData(`\nGracefully shutting down Express` );
    app.dataFetcher.stop();
	process.exit( );
})
