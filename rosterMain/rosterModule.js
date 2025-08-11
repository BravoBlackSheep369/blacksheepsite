require("dotenv").config()
const fs = require("fs");
const Database = require("./rosterDatabase.js");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const csvtojson = require("csvtojson");
const { log } = require("console");


//Logging
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
        //check if it's an object to convert to a json string
        if ( otherArgs[i] !== undefined && Object.keys(otherArgs[i]).length > 0 ){
            data += JSON.stringify(otherArgs[i])
        } else {
            data += otherArgs[i];
        }
    }
    try {
        fs.appendFileSync(logName, data);
        console.log('The data was appended to file!');
      } catch (err) {
        console.log("Just kidding, no workie: ", err);
      }
}

//This is an important function, the entire data structure relies on the spreadsheet being formatted in the way it is 
// (scheduled dates at the top, scheduled hours on the left side)
// Based on that, it formats it to a custom json structure "date range" = ["date" = { "hour" = { room: num, name: string }}]
//transforms json csv to a formatted json architecture
exports.FormatCSVJSONtoJSON = function(csvjson){
    const result = {};
    let currentDateRange = null;
    let currentDays = [];

    function extractDaysFromHeader(row) {
        const dateRange = Object.keys(row)[0];
        const days = [];

        for (let i = 2; i <= 15; i += 2) {
            const day = row[`field${i}`];
            if (day && day.trim()) {
                days.push({
                    day,
                    roomIndex: `field${i}`,
                    nameIndex: `field${i + 1}`
                });
            }
        }

        return { dateRange, days };
    }

    for (let i = 0; i < csvjson.length; i++) {
        const row = csvjson[i];
        const rowKey = Object.keys(row)[0];
        const keyValue = row[rowKey];

        // Header Row: (e.g. HOURS row)
        if (keyValue && keyValue.toUpperCase() === "HOURS") {
            const { dateRange, days } = extractDaysFromHeader(row);
            currentDateRange = dateRange;
            currentDays = days;
            result[currentDateRange] = {};
            continue;
        }

        // Skip column headers like "Room", "Name", etc.
        if (keyValue && keyValue.toUpperCase() === "TIME") {
            continue;
        }

        // CQ time rows come in pairs: one rowA and one rowB
        const rowA = row;
        const rowB = csvjson[i + 1] || {};
        let timeKey = rowA[currentDateRange];
        if (timeKey === undefined || timeKey === null || timeKey.trim() === "") {
            timeKey = rowB[currentDateRange];
        }
        if (!timeKey || timeKey.trim() === "") continue;


        currentDays.forEach(({ day, roomIndex, nameIndex }) => {
            // Initialize structure
            if (!result[currentDateRange][day]) result[currentDateRange][day] = {};
            if (!result[currentDateRange][day][timeKey]) result[currentDateRange][day][timeKey] = {};
            const slot = result[currentDateRange][day][timeKey];
            // From Row A
            const roomA = rowA[roomIndex];
            const nameA = rowA[nameIndex];
            if (roomA && nameA) {
                if (!slot[roomA]) slot[roomA] = [];
                if (!slot[roomA].includes(nameA)) slot[roomA].push(nameA);
            }

            // From Row B
            const roomB = rowB[roomIndex];
            const nameB = rowB[nameIndex];
            if (roomB && nameB) {
                if (!slot[roomB]) slot[roomB] = [];
                if (!slot[roomB].includes(nameB)) slot[roomB].push(nameB);
            }

        });

        // Skip the next row (rowB) since it's already processed
        i++;
    }
    
    return result;

}

exports.FetchSheetJSON = async function(SheetID) {
    
    const jsondiffpatch = await import('jsondiffpatch').then(mod => mod.default || mod);
    const jsonpatchFormatter = await import('jsondiffpatch/formatters/jsonpatch');
    
    const rosterURL = 'https://docs.google.com/spreadsheets/d/11SQdynZVQAA6YyEXvH2JTmO29qgWcn-RXFJOnz8DosM/export?format=csv&gid='+SheetID;
    const csvresponse = await fetch(rosterURL, {
      method: 'GET', // Or 'POST', 'PUT', etc.
      headers: {
        'Accept': 'application/json'
      }
    }).catch(function(err) {
        console.log("[FetchSheetJSON] Error: " + String(err));
    });
    const responseTotext = await csvresponse.text();
    const response = await csvtojson().fromString(responseTotext).subscribe((json)=>{
        return new Promise((resolve,reject)=>{
            resolve(json);
        })
    });
    const output = this.FormatCSVJSONtoJSON(response);
    //lets remove the empty field and the comment from the bottom of the spreadsheet
    Object.keys(output).forEach(function(dayRange) {
        Object.keys(output[dayRange]).forEach(function(theDay){
            if (theDay == "N/A") {
                delete output[dayRange][theDay];
                return
            }
            Object.keys(output[dayRange][theDay]).forEach( async function(theTime) {
                if( theTime.length > 15){
                    delete output[dayRange][theDay][theTime];
                    return
                }
            })
        })
    })

    await Object.keys(output).forEach( async function(dayRange) {

        //Checks if range exists, if it does, compare the looped shifts with the ones in the database to see if there are changes
        let CheckForChanges = false

        const doesRangeExists = await Database.DoesDateRangeExist(dayRange)
        if (!doesRangeExists.Error && !doesRangeExists.Data) {

            let addRange = await Database.AddDateRange(dayRange)

            if ( addRange.Error){
                logData(`Failed to create ${dayRange}`);
            } else {
                logData(`Created dayRange ${dayRange}`)
            }
        }

        await Object.keys(output[dayRange]).forEach(async function(theDay){
            const doesDayExists = await Database.DoesDayExist(theDay)
            if (!doesDayExists.Error && !doesDayExists.Data) {
                let addDay = await Database.AddDate(theDay, dayRange)
                if ( addDay.Error){
                    logData(`Failed to add day ${theDay}`);
                } else {
                    logData(`Created day ${theDay}`)
                }
            } else {
                CheckForChanges = true;
            }
            
            /*
                TODO: Fix issue where troop is not being saved/saved to the DB
            */

            await Object.keys(output[dayRange][theDay]).forEach( async function(theTime) {
                
                let shiftsAtTime = output[dayRange][theDay][theTime];
                if (shiftsAtTime == undefined) { return; }
                let prevTroopOnShift = await Database.GetTroopOnHourShift(theTime, theDay);
                let right = {}
                let isSelf = false;
                if ( !prevTroopOnShift.Error && prevTroopOnShift.Data ){
                    let prevTroopArray = prevTroopOnShift.Data;
                    //Add the stored DB to the right side for comparasion
                    for (index in prevTroopArray) {
                        let prevName = prevTroopArray[index];
                        if ( right[prevName.ROOM] == undefined) {
                            right[prevName.ROOM] = [];
                        }
                        right[prevName.ROOM].push(prevName.Name)
                    }
                }
                let left = shiftsAtTime;
                const delta = jsondiffpatch.diff(right, left );
                const patch = await jsonpatchFormatter.format(delta);
                if (patch.length > 0 || isSelf ) {
                    for (index in patch) {
                        let change = patch[index];
                        const pathArray = change.path.split("/");
                        switch (change.op) {
                            case "remove": 
                                const roomKey = pathArray[1];
                                const valPosRemoved = pathArray[2];
                                const valRemoved = right[roomKey][valPosRemoved];
                                
                                //if room key is empty/null, skip removing it
                                if (roomKey == undefined || roomKey == "null" || roomKey == null) { return; }

                                const ErrOut = await Database.RemoveTroop(valRemoved, roomKey, theTime, theDay)
                                if (ErrOut.Error) {
                                    logData("Failed to remove ", valRemoved)
                                }
                                let saveChange = await Database.AddChange(change.op, valRemoved, roomKey, undefined, undefined, theTime, theDay, dayRange)
                                if (saveChange.Error){
                                    logData(`[FetchSheetJSON/remove] Unable to add change to DB ${nameOfToBeAdded}, ${rookK}, ${theTime} ${theDay}`)
                                }
                                //logData(`[FetchSheetJSON/remove] Removed troop ${valRemoved} from date ${theDay}`)
                                break
                            
                            case "add": 
                                if (Array.isArray( change.value ) ) {
                                    change.value.forEach( async function(nameOfToBeAdded) {
                                        let roomK = pathArray[1]

                                        //if room key is empty/null, skip adding it
                                        if (roomK == undefined || roomK == "null" || roomK == null) { return; }

                                        let addedTroop = await Database.AddTroop(nameOfToBeAdded, theTime, roomK, theDay)
                                        if ( addedTroop.Error ){
                                            logData("[FetchSheetJSON] Failed to add troop: ",nameInEach, ", on shift ", theTime, " : ", theDay);
                                            return;
                                        }

                                        let savedChanged = await Database.AddChange(change.op, undefined, undefined, nameOfToBeAdded, roomK, theTime, theDay, dayRange)
                                        if (savedChanged.Error){
                                            logData(`[FetchSheetJSON/add] Unable to add change to DB ${nameOfToBeAdded}, ${roomK}, ${theTime} ${theDay}`)
                                            return
                                        }
                                        logData(`[FetchSheetJSON/add/forEach] Added troop/s "${nameOfToBeAdded}" at room "${pathArray[1]}", output from Addtroop: ${JSON.stringify(addedTroop)} `)
                                        logData(`[FetchSheetJSON/add/forEach] Added change/s "${nameOfToBeAdded}", "${roomK}", "${theTime}" "${theDay}", change output: ${JSON.stringify(savedChanged)} `)
                                    })
                                    break;
                                } else {
                                    let roomK = pathArray[1]
                                    let name = change.value;

                                    //if room key is empty/null, skip adding it
                                    if (roomK == undefined || roomK == "null" || roomK == null) { return; }

                                    let addedTroop = await Database.AddTroop(name, theTime, roomK, theDay)
                                    if ( addedTroop.Error ){
                                        logData("[FetchSheetJSON] Failed to add troop: ",nameInEach, ", on shift ", theTime, " : ", theDay);
                                        return;
                                    }

                                    let savedChanges = await Database.AddChange(change.op, undefined, undefined, name, roomK, theTime, theDay, dayRange)
                                    if (savedChanges.Error){
                                        logData(`[FetchSheetJSON/add] Unable to add change to DB ${name}, ${rookK}, ${theTime} ${theDay}`)
                                    }
                                    //logData(`[FetchSheetJSON/add] Added troop/s "${name}" at room "${pathArray[1]}" `)
                                }
                                break
                            case "replace":
                                const newVal = change.value;
                                const roomKeyVal = pathArray[1];
                                const valPosRemovedIndex = pathArray[2];
                                const valNameRemoved = right[roomKeyVal][valPosRemovedIndex];
                                //removes old name
                                let removeTrop = await Database.RemoveTroop(valNameRemoved, roomKeyVal, theTime, theDay);
                                if (removeTrop.Error) {
                                    logData("[FetchSheetJSON/replace] Unable to remove troop: ", valNameRemoved)
                                }
                                //adds new troop name
                                let addNewVal = await Database.AddTroop(newVal, theTime, roomKeyVal, theDay)
                                if (addNewVal.Error) {
                                    logData("[FetchSheetJSON/replace] Unable to add new troop name: ", newVal)
                                }
                                let savedChange = await Database.AddChange(change.op, valNameRemoved, roomKeyVal, newVal, roomKeyVal, theTime, theDay, dayRange)
                                if (savedChange.Error){
                                    logData(`[FetchSheetJSON/replace] Unable to add change to DB ${valNameRemoved}, ${roomKeyVal}, ${newVal}, ${roomKeyVal}, ${theDay}`)
                                    break;
                                }
                                //logData(`[FetchSheetJSON/replace] Replaced "${valNameRemoved}" with new val "${newVal}"`)
                                break
                            default:
                                logData("[FetchSheetJSON/default] No case for output change: ",change);
                        }
                    }
                }

            })
        });
    })

    return output;
}


exports.FetchSheetIDs = async function(){
    const GOOGLE_KEY = process.env.GOOGLE_DOC_KEY;

    if ( GOOGLE_KEY == undefined) { console.log("[FetchSheetIDs] Missing Google Doc API Key!"); return []; }

    const spreadSheetInfo = "https://sheets.googleapis.com/v4/spreadsheets/11SQdynZVQAA6YyEXvH2JTmO29qgWcn-RXFJOnz8DosM?fields=sheets(properties(title%2CsheetId))&key="+process.env.GOOGLE_DOC_KEY;
    const response = await fetch(spreadSheetInfo, {
      method: 'GET', // Or 'POST', 'PUT', etc.
      headers: {
        'Accept': 'application/json'
      }
    }).catch(function(err) {
        console.log("[FetchSheetIDs] Error: " + String(err));
    });
    let responseJSON = await response.json();
    const sheetsArray = responseJSON["sheets"];
    let IDArray = [];
    for (index in sheetsArray) {
        let props = sheetsArray[index]["properties"];
        IDArray.push([props["sheetId"], props["title"]]);
    }
    return IDArray;
}