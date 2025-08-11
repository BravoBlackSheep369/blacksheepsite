const sqlite3 = require('sqlite3');

sqlite3.verbose();


//Logging

const fs = require("fs");
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

const MainDB = new sqlite3.Database('./database/MainDatabase.sql', function(eror){
    if (eror !== null){
        logData("MainDatabase error: "+eror);
        console.log(eror)
    }
});


function SuccessObject(CustomMessage, SuccessObject) {
    return {
        Data: SuccessObject,
        Success: CustomMessage
    }
}
function ErrorObject(CustomMessage, ErrorMessage){
    logData(CustomMessage, ErrorMessage)
    return {
        Data: CustomMessage,
        Error: ErrorMessage
    }
}
//Creates tables if they don't exists
MainDB.serialize(function() {
    //saves Day range e.g. 07 July - 04 Aug, this is where the singular day falls under, used to quickly retrieve/delete a range of dates/shifts
    MainDB.run(`
        CREATE TABLE IF NOT EXISTS DayRanges (
            DayRange TEXT PRIMARY KEY NOT NULL,
            EditedOn TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            logData("[DayRanges] Unable to Create Table DayRanges: " + err);
        }
    });
    //stores the singular day, this is where the troop shifts fall under
    MainDB.run(`
        CREATE TABLE IF NOT EXISTS DayDate (
            Date TEXT NOT NULL PRIMARY KEY,
            DayRange TEXT NOT NULL,
            FOREIGN KEY (DayRange) REFERENCES DayRanges (DayRange)
        )
    `, (err) => {
        if (err) {
            logData("[DayDate] Unable to Create Table DayDate: " + err);
        }
    });
    //Stores a troops shift
    MainDB.run(`
        CREATE TABLE IF NOT EXISTS Troop (
            Name TEXT PRIMARY KEY NOT NULL,
            ROOM TEXT NOT NULL,
            HOUR TEXT NOT NULL,
            Date TEXT NOT NULL,
            FOREIGN KEY (Date) REFERENCES DayDate (Date)
        )
    `, (err) => {
        if (err) {
            logData("[Troop] Unable to Create Table Troop: " + err);
        }
    });
    /*
    ChangeType: 
        -REPLACE, REMOVE, ADD, MOVE(?)
    */
    MainDB.run(`
        CREATE TABLE IF NOT EXISTS Changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ChangeType TEXT NOT NULL,
            OldValue TEXT,
            OldValueKey TEXT,
            NewValue TEXT,
            NewValueKey TEXT,
            HourShift TEXT,
            TroopDate TEXT,
            TroopDateRange TEXT,
            EditedOn TEXT NOT NULL,
            UNIQUE (
                ChangeType,
                OldValue,
                OldValueKey,
                NewValue,
                NewValueKey,
                HourShift,
                TroopDate,
                TroopDateRange
            )
        )
    `, (err) => {
        if (err) {
            logData("[Changes] Unable to Create Table Changes: " + err);
        }
    });

});


//---------------------------   Checks   ---------------------------

/**
*
* @param {String} DateRange
*/
exports.DoesDateRangeExist = async function(DateRange) {
    if (DateRange == "" || DateRange == undefined || DateRange == null) {
        return ErrorObject("[DB/DoesDateRangeExist] Did not pass a valid DateRange ", "DateRange passed: "+String(DateRange));
    }
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.get(`
                SELECT EditedOn 
                FROM DayRanges 
                WHERE DayRange == "${DateRange}%"
                `,(era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/DoesDateRangeExist] Failed to get Date range \""+DateRange+"\": ", era));
                }
                if (thi == undefined){
                    return resolve(SuccessObject("[DB/DoesDateRangeExist] Date Range not exists", false));
                }
                resolve(SuccessObject("[DB/DoesDateRangeExist] Date Range Exists", thi))
            });
        });
    });
}

/**
*
* @param {String} Day
*/
exports.DoesDayExist = async function (Day) {
    if (Day == "" || Day == undefined || Day == null) {
        return ErrorObject("[DB/DoesDayExist] Did not pass a Day ", "Day passed: "+String(Day));
    }
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.get(`
                SELECT DayRange
                FROM DayDate 
                WHERE Date == ?
                `,
                [Day],
                (era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/DoesDayExist] Failed to get Day \""+Day+"\": ", era));
                }
                if (thi == undefined) {
                    return resolve(SuccessObject("[DB/DoesDayExist] Day Does not exist", false));
                }
                resolve(SuccessObject("[DB/DoesDayExist] Day EXists", true))
            });
        });
    });
}
/**
*
* @param {String} ChangeType
* @param {String} OldValue
* @param {String} OldValueKey
* @param {String} NewValue
* @param {String} NewValueKey
* @param {String} ShiftHour
* @param {String} dayDate
* @param {String} DateRange
*/
exports.DoesChangeExist = async function(ChangeType, OldValue, OldValueKey, NewValue, NewValueKey, ShiftHour, dayDate, dateRange){
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.get(`
                SELECT *
                FROM Changes 
                WHERE ChangeType == ?
                AND OldValue == ?
                AND OldValueKey == ?
                AND NewValue == ?
                AND NewValueKey == ?
                AND HourShift == ?
                AND TroopDate == ?
                AND TroopDateRange == ?
                `,
                [
                    (ChangeType !== undefined && ChangeType !== null && ChangeType !== "null" ) ? ChangeType : "null",
                    OldValue !== undefined && ChangeType !== null && ChangeType !== "null" ? OldValue : "null",
                    OldValueKey !== undefined && OldValueKey !== null && OldValueKey !== "null" ? OldValueKey : "null",
                    NewValue !== undefined && NewValue !== null && NewValue !== "null" ? NewValue : "null",
                    NewValueKey !== undefined && NewValueKey !== null && NewValueKey !== "null" ? NewValueKey : "null",
                    ShiftHour !== undefined && ShiftHour !== null && ShiftHour !== "null" ? ShiftHour : "null",
                    dayDate !== undefined && dayDate !== null && dayDate !== "null" ? dayDate : "null",
                    dateRange !== undefined && dateRange !== null && dateRange !== "null" ? dateRange : "null"
                ],
                (era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/DoesChangeExist] Failed to get Change, error: ", era));
                }
                if (thi == undefined) {
                    return resolve(SuccessObject("[DB/DoesChangeExist] Change Does not exist", false));
                }
                resolve(SuccessObject("[DB/DoesChangeExist] Change Exists", true))
            });
        });
    });
}


//---------------------------   Getters   ---------------------------

/**
*
* @param {String} DayDate
*/
exports.GetShiftsForDay = async function(DayDate) {
    if (DayDate == "" || DayDate == undefined || DayDate == null) {
        return ErrorObject("[DB/GetShiftsForDay] Did not pass a DayDate ", "DayDate passed: "+String(DayDate));
    }
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.all(`
                SELECT Name, ROOM, HOUR
                FROM Troop 
                WHERE Date == "${DayDate}"
                `,(era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/GetShiftsForDay] Failed to get DayDate \""+DayDate+"\": ", era));
                }
                if (thi == undefined){
                    return resolve(SuccessObject("[DB/GetShiftsForDay] Entry was empty", false));
                }
                resolve(SuccessObject("[DB/GetShiftsForDay] Got DayDate", thi))
            });
        });
    });
}

/**
*
* @param {String} TroopName
*/
exports.GetShiftsForTroop = async function(TroopName) {
    if (!TroopName) {
        return ErrorObject("[DB/GetShiftsForTroop] Invalid TroopName", "TroopName passed: " + String(TroopName));
    }

    return new Promise((resolve, reject) => {
        const sql = `
            SELECT 
                T2.Name,
                T2.Date,
                T2.HOUR,
                T2.ROOM,
                DD.DayRange
            FROM Troop T1
            INNER JOIN Troop T2
                ON T1.Date = T2.Date
               AND T1.HOUR = T2.HOUR
               AND T1.ROOM = T2.ROOM
            INNER JOIN DayDate DD
                ON T2.Date = DD.Date
            WHERE T1.Name LIKE ?
        `;

        MainDB.all(sql, [TroopName + '%'], (err, rows) => {
            if (err) {
                return resolve(ErrorObject("[DB/GetShiftsForTroop] DB error", err));
            }

            if (!rows || rows.length === 0) {
                return resolve(SuccessObject("[DB/GetShiftsForTroop] No shifts found for troop", false));
            }

            resolve(SuccessObject("[DB/GetShiftsForTroop] Retrieved shiftmates and info", rows));
        });
    });
};

/**
*
* @param {String} TroopName
* @param {String} theDay
*/
exports.GetShiftOnDayForTroop = async function(TroopName, theDay) {
    if (TroopName == "" || TroopName == undefined || TroopName == null) {
        return ErrorObject("[DB/GetShiftOnDayForTroop] Did not pass a valid TroopName ", "TroopName passed: "+String(TroopName));
    }
    if (theDay == "" || theDay == undefined || theDay == null) {
        return ErrorObject("[DB/GetShiftOnDayForTroop] Did not pass a valid theDay ", "theDay passed: "+String(theDay));
    }
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.all(`
                SELECT 
                    HOUR, 
                    ROOM
                FROM 
                    Troop 
                WHERE 
                    Name LIKE "${TroopName}%"
                AND 
                    Date == "${theDay}"
                `,(era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/GetShiftOnDayForTroop] Failed to get troop \""+TroopName+"\": ", era));
                }
                if (thi.length <= 0){
                    return resolve(SuccessObject("[DB/GetShiftOnDayForTroop] Entry was empty", false))
                }
                resolve(SuccessObject("[DB/GetShiftOnDayForTroop] Got troop name", thi))
            });
        });
    });
}

/**
*
* @param {String} Hour
* @param {String} TheDay
*/
exports.GetTroopOnHourShift = async function(Hour, TheDay) {
    if (Hour == "" || Hour == undefined || Hour == null) {
        return ErrorObject("[DB/GetTroopOnHourShift] Did not pass a valid Hour ", "Hour passed: "+String(Hour));
    }
    if (TheDay == "" || TheDay == undefined || TheDay == null) {
        return ErrorObject("[DB/GetTroopOnHourShift] Did not pass a valid TheDay ", "TheDay passed: "+String(TheDay));
    }


    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.all(`
                SELECT 
                    Name, ROOM 
                FROM 
                    Troop 
                WHERE 
                    HOUR == "${Hour}"
                AND 
                    Date == "${TheDay}"
                `,(era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/GetTroopOnHourShift] Failed to get TheDay \""+TheDay+"\" and HOUR \""+Hour+"\": ", era));
                }
                if (thi == undefined || thi.length == 0){
                    return resolve(SuccessObject("[DB/GetTroopOnHourShift] Entry was empty", false));
                }
                resolve(SuccessObject("[DB/GetTroopOnHourShift] Got TheDay and hour", thi))
            });
        });
    });
}

exports.GetAllChanges = async function() {
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.all(`
                SELECT
                    *
                FROM
                    Changes
                `, (era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/GetAllChanges] Failed to get Changes, error: ", era));
                }
                if (thi.length <= 0 || thi == undefined){
                    return resolve(SuccessObject("[DB/GetAllChanges] Changes was empty", false));
                }
                resolve(SuccessObject("[DB/GetAllChanges] Got changes results", thi))
            });
        });
    });
}

//The bottom two are used when you know what you are doing. Such as running hardcoded queries. Can be used in a node terminal 
/**
*
* @param {String} query
*/
exports.GetDataFromDB = async function(query) {
    if (query == "" || query == undefined || query == null) {
        return ErrorObject("[DB/GetDataFromDB] Did not pass a query ", "query passed: "+String(query));
    }
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.all(query, (era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/GetDataFromDB] Failed to get query \""+query+"\": ", era));
                }
                if (thi.length <= 0){
                    return resolve(SuccessObject("[DB/GetDataFromDB] Entry was empty", false))
                }
                resolve(SuccessObject("[DB/GetDataFromDB] Got query results", thi))
            });
        });
    });
}

/**
*
* @param {String} query
* @param {String:String} args
*/
exports.RunDB = async function(query, args) {
     if (query == "" || query == undefined || query == null) {
        return ErrorObject("[DB/RunDB] Did not pass a query ", "query passed: "+String(query));
    }
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.run(query, args, (era,thi) =>{
                if(era){
                    return resolve(ErrorObject("[DB/RunDB] Failed to get query \""+query+"\": ", era));
                }
                if (thi == undefined){
                    return resolve(SuccessObject("[DB/RunDB] Failed to run query", false));
                }
                resolve(SuccessObject("[DB/RunDB] Got query results", thi))
            });
        });
    });
}

//---------------------------   Setters   ---------------------------

/**
*
* @param {String} dayrange
*/
exports.AddDateRange = async function(dayrange) {
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.run(`
                INSERT OR IGNORE INTO DayRanges (DayRange, EditedOn) 
                VALUES ($DayRange, strftime('%Y-%m-%d %H:%M:%S', 'now'))
            `, {
                $DayRange: dayrange
            }, (err) => {
                if (err) {
                    resolve(ErrorObject("[DB/AddDateRange] Failed to add dayrange for \""+dayrange+"\": ", err));
                    return;
                }
                resolve(SuccessObject("[DB/AddDateRange] Saved dayrange", 'Success'));
            });
        });
    });
}

exports.AddDate = async function(DayDate, DayRange) {
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.run(`
                INSERT OR IGNORE INTO DayDate (date, DayRange) 
                VALUES ($daydate, $DayRange)
            `, {
                $DayRange: DayRange,
                $daydate: DayDate
            }, (err) => {
                if (err) {
                    return resolve(ErrorObject(`[DB/AddDate] Failed to add Date (${DayDate}) for range (${DayRange}), error: `, err));
                }
                resolve(SuccessObject("[DB/AddDate] Saved dayrange", 'Success'));
            });
        });
    });
}

exports.AddTroop = async function(troopName, Hour, Room, DayDate){
    if (troopName == "" || troopName == undefined || troopName == null) {
        return ErrorObject("[DB/AddTroop] Did not pass a valid string for troop name ", "Troop Name passed: "+String(troopName));
    }
    if (Hour == "" || Hour == undefined || Hour == null) {
        return ErrorObject("[DB/AddTroop] Did not pass a valid string for Hour shift ", "hour shift passed: "+String(Hour));
    }
    if (Room == "" || Room == undefined || Room == null) {
        return ErrorObject("[DB/AddTroop] Did not pass a valid string for room number ", "Room Num passed: "+String(Room));
    }
    if (DayDate == "" || DayDate == undefined || DayDate == null) {
        return ErrorObject("[DB/AddTroop] Did not pass a valid string for Day Date ", "Day Date passed: "+String(DayDate));
    }

    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.run(`
                INSERT OR IGNORE INTO Troop (Name, ROOM, HOUR, Date) 
                VALUES ($Name, $Room, $Hour, $Date)
            `, {
                $Name: troopName,
                $Room: Room,
                $Hour: Hour,
                $Date: DayDate
            }, (err) => {
                if (err) {
                    return resolve(ErrorObject(`[DB/AddTroop] Failed to add Troop Name: "${troopName}", HourShift: "${Hour}", Room: "${Room}", DayDate: "${DayDate}" `, err));
                }
                return resolve(SuccessObject("[DB/AddTroop] Saved Troop", 'Success'));
            });
        });
    });
}

exports.RemoveTroop = async function(TroopName, TroopRoom, HourShift, DayDate) {
    let query = ""
    let args  = {}
    //if only passed a room but no name, then delete all in that room/shift
    if( TroopName == undefined && TroopRoom !== undefined && HourShift !== undefined && DayDate !== undefined){
        query = `
        DELETE FROM 
            TROOP
        WHERE 
            ROOM == $Room
        AND 
            Date == $Date
        AND 
            HOUR == $Hour
        `
        args = {
                $Room: TroopRoom,
                $Hour: HourShift,
                $Date: DayDate
            }
    } else if (TroopName !== undefined && TroopRoom !== undefined && HourShift !== undefined && DayDate !== undefined) {
        query = `DELETE FROM 
                    Troop
                WHERE 
                    Name == $Name
                AND 
                    ROOM == $Room
                AND 
                    Date == $Date
                AND 
                    HOUR == $Hour`;
        args = {
                $Name: TroopName,
                $Room: TroopRoom,
                $Hour: HourShift,
                $Date: DayDate
            }
    } else {

        logData("[DB/RemoveTroop] Passed in more empty arguments than expected: ", TroopName, TroopRoom, HourShift, DayDate)
        return ErrorObject("[DB/RemoveTroop] Passed in more empty arguments than expected: ", TroopName, TroopRoom, HourShift, DayDate)
    }

    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function(){
            MainDB.run(query, args, (err) => {
                if (err) {
                    resolve(ErrorObject("[DB/RemoveTroop] failed to remove troop", err))
                    return;
                }
                resolve(SuccessObject("[DB/RemoveTroop] successfuly removed troop", "Success"))
            })
        })

    })
}
exports.CleanupOldChanges = async function () {
    //it's -8 because the stored date/time in the DB is in UTC, since Georgias local time is -4,
    // and we want to delete everything that is 4 hours old, we add an extra 4 hours, hence -8
    const query = `
        DELETE FROM 
            Changes
        WHERE 
            EditedOn <= datetime('now', '-8 hours')
    `;

    return new Promise((resolve, reject) => {
        MainDB.run(query, function (err) {
            if (err) {
                return resolve(ErrorObject("[DB/CleanupOldChanges] Failed to delete old entries", err));
            }
            return resolve(SuccessObject("[DB/CleanupOldChanges] Deleted old entries", this.changes));
        });
    });
};



exports.AddChange = async function (ChangeType, OldValue, OldValueKey, NewValue, NewValueKey, ShiftHour, dayDate, dateRange) {
    let query = ""
    let insertObj = {}
    switch (ChangeType) {
        case "add":
            query = `INSERT OR IGNORE INTO Changes (ChangeType, NewValue, NewValueKey, HourShift, TroopDate, TroopDateRange, EditedOn)
            VALUES ($ChangeT, $NewVal, $NewValKey, $HrShft, $TroopDay, $DtRange, strftime('%Y-%m-%d %H:%M:%S', 'now'))`
            insertObj = {
                $ChangeT: ChangeType,
                $NewVal: NewValue,
                $NewValKey: NewValueKey,
                $HrShft: ShiftHour,
                $TroopDay: dayDate,
                $DtRange: dateRange
            }
            break;
        case "remove":
            query = `INSERT OR IGNORE INTO Changes (ChangeType, OldValue, OldValueKey, HourShift, TroopDate, TroopDateRange, EditedOn)
            VALUES ($ChangeT, $OldVal, $OldValKey, $HrShft, $TroopDay, $DtRange, strftime('%Y-%m-%d %H:%M:%S', 'now'))`
            insertObj = {
                $ChangeT: ChangeType,
                $OldVal: OldValue,
                $OldValKey: OldValueKey,
                $HrShft: ShiftHour,
                $TroopDay: dayDate,
                $DtRange: dateRange
            }
            break;
        case "replace":
            query = `INSERT OR IGNORE INTO Changes (ChangeType, OldValue, OldValueKey, NewValue, NewValueKey, HourShift, TroopDate, TroopDateRange, EditedOn)
            VALUES ($ChangeT, $OldVal, $OldValKey, $NewVal, $NewValKey, $HrShft, $TroopDay, $DtRange, strftime('%Y-%m-%d %H:%M:%S', 'now'))`
            insertObj = {
                $ChangeT: ChangeType,
                $OldVal: OldValue,
                $OldValKey: OldValueKey,
                $NewVal: NewValue,
                $NewValKey: NewValueKey,
                $HrShft: ShiftHour,
                $TroopDay: dayDate,
                $DtRange: dateRange
            }
            break;
        default:
            logData(`[DB/AddChange] Unable to set query/insertObj for ChangeType "${ChangeType}" `)
            return new Promise(async function(resolve, reject) { 
                resolve(ErrorObject(`[DB/AddChange] Unable to set query/insertObj for ChangeType "${ChangeType}" `))
            });
    }

    let doesItExistAlready = await exports.DoesChangeExist(ChangeType, OldValue, OldValueKey, NewValue, NewValueKey, ShiftHour, dayDate, dateRange)
    //console.log("Does it exists already? :", doesItExistAlready)

    if (!doesItExistAlready.Error && doesItExistAlready.Data){
        return new Promise(async function(resolve, reject) { 
                resolve(ErrorObject(`[DB/AddChange/CheckExists] Unable to add change, already exists for the same shift/troop. `))
            }); 
    }
    return new Promise(async function(resolve, reject) {
        MainDB.serialize(function() {
            MainDB.run(query, insertObj, (err) => {
                if (err) {
                    return resolve(ErrorObject(`[AddChange] Failed to save change of type "${ChangeType} ${JSON.stringify(insertObj)}",  `, err));
                }
                return resolve(SuccessObject("[AddChange] Saved Change", 'Success'));
            });
        });
    });
}