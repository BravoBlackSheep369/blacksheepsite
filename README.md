# BlacksheepSite
Site to view Roster in a better format than the google spreadsheet provides by darkening the shifts that have already passed. You can also view just your shifts by going to the `/yourname` endpoint (obviously replacing `yourname` wuth your name). Also provides API endpoints to get the shifts for custom integration into any other software/application you prefer for custom UI (such as the Scriptable app on Iphone). The server gets the roster from the google spreadsheet every 30 minutes, meaning it will always show the updated version (as long as you refresh the website like every 31 minutes)

Desktop:

<img width="1960" height="1347" alt="image" src="https://github.com/user-attachments/assets/de3505d6-7772-49af-bc6a-285d0543c023" />

Mobile: 

<img width="300" height="582" alt="image" src="https://github.com/user-attachments/assets/0826112d-c419-448d-aac4-e776360a0f35" />

Link Embeds:

<img width="742" height="266" alt="image" src="https://github.com/user-attachments/assets/c340e889-dbf6-4ca6-8b95-84bb7746376d" />


# Table of Contents
* [Requirements ( os / package manager)](https://github.com/BravoBlackSheep369/blacksheepsite/edit/main/README.md#requirements--os--package-manager)
* [Initial install (updates / modules / environment variables)](https://github.com/BravoBlackSheep369/blacksheepsite/edit/main/README.md#initial-install-updates--modules--environment-variables)
* [Run Site as a Service (in the background)](https://github.com/BravoBlackSheep369/blacksheepsite/edit/main/README.md#run-site-as-a-service-in-the-background)
* [Running Website (in the forground)](https://github.com/BravoBlackSheep369/blacksheepsite/edit/main/README.md#running-website-in-the-forground)
* [APIs](https://github.com/BravoBlackSheep369/blacksheepsite/edit/main/README.md#apis)
* [Things to work on (non-finished features / ideas for additions / current issues)](https://github.com/BravoBlackSheep369/blacksheepsite/edit/main/README.md#things-to-work-on-non-finished-features--ideas-for-additions)
# Requirements ( os / package manager)
This was installed on a server running `Ubuntu 22.04 LTS Jammy`.
[You can also download the os image here](https://releases.ubuntu.com/jammy/)

You need to have installed npm, the node package manager which you can [find here](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
or just run `sudo apt install nodejs npm -y` or install nvm to install a specific version of node.
- npm version: 10.9.2
- node version: v22.15.0

You need a Google API Key, which you can create [from here:](https://console.cloud.google.com/apis/credentials)

# Initial install (modules / environment variables)
Navigate to the project folder and run `npm install .`. This installs the required modules retrieved from `projectFolder/package.json` file.

You need to create a `.env` file (you can run `touch .env` to create an empty file, or just `nano .env`) in the same directory where `app.js` is located.

These are the contents that the `.env` should have:
```env
  GOOGLE_DOC_KEY="KEYHERE"
```
Replace "`KEYHERE`" with your google API key which you can retrieve [from here](https://console.cloud.google.com/apis/credentials). This is used for retrieving the data from the spreadsheet, there's no alternative so this is a requirement.

# Run Site as a Service (in the background)
To run the website in the background you need to create a service file. Run `sudo nano /etc/systemd/system/rostersite.service`, replacing `rostersite` with whatever you want to call the service or leave as is. Then place this in the contents, be sure to replace `/home/blacksheep/blacksheepbot/rostersite` and `User=blacksheep` with the correct path and the created username:
```service
[Unit]
Description=Service for blacksheep site
After=network.target

[Service]
User=blacksheep
ExecStart=/home/blacksheep/blacksheepbot/rostersite/startsite.sh
Restart=on-failure
RestartSec=90s

[Install]
WantedBy=multi-user.target
```
Once you've edited, press `ctrl-x` and accept the changes. 

Make sure you edit the `startsite.sh` so the path in that file points to the directory of where your `app.js` is located.

Then run `sudo systemctl daemon-reload`, then `systemctl enable rostersite && systemctl start rostersite`, of course also replacing `rostersite` with what you called the service earlier. Now that it is started you can `stop`, `start` or `restart` by just replacing "start" with one of those words in this command: `systemctl start rostersite`.

You can also view the console output from the service (like when you do `console.log` in the application) you can run `journalctl -fu rostersite --lines 1000`, the `--lines 1000` arguments tells journal you want to see 1000 previously logged log lines this argument is optional so you can ommit it if you dont want to see previous logs. In `-Fu` the `f` means "follow", which is to continously output the logs as they come in. The `u` from `-fu` means the journal from a specific "unit/service", in our case our service in `rostersite`. 

# Running Website (in the forground)
If you dont want to run the site as a service and only keep it up while you have the terminal open then you can run `node ./app.js` and to close it just do `ctrl-c` or close the terminal window.

# APIs
There are a couple APIs you can use for displaying things the way you want it, you can use these in apps such as `Shortcuts` or `Scriptable` to create your own Iphone Widgets or anything else.

### `/changes`

  Returns JSON object in the following format:
  
    
    ["Date Range"] : {
      ["Date"] : {
        ["Hour Shift"] : {
          ["Room Key"] : [ { operation: changeType, old: oldVal, new: newVal, dateAndTime: dateTimeChangeSaved } ]
        }
      }
    }
    
    
  `changeType` is a String that can be either "add", "replace", "remove" or "move"
  
### `/getroster`

  Returns JSON object in the same format as above, with the following exception:
  
    
      ...
        ["Room Key"] : [ "Troop Name", "other roommate name" ]
    

# Things to work on (non-finished features / ideas for additions / current issues)
The features the still need fixing is the `changes` feature. The idea was to display when a change to the spreadsheet was made and then display that on the website, this would be done by saving each shift in the spreadsheet to a local Database, then throughout the day fetching the spreadsheet and comparing it with what is in the Database. If it's different, it would store the changes in the Database as well so the user can get all changes made. You can see remnants of this feature on the site by pressing `F12` and selecting a singular troop on a shift in the Element view:

<img width="1398" height="575" alt="image" src="https://github.com/user-attachments/assets/09f449b2-8c3c-4f7d-a50e-67f1336ae29a" />

The additional idea for when the "changes" feature would have been finished, was to add mentions in the Discord when a Troop was "added", "deleted" or "moved" from the spreadsheet roster.

Another idea is to have the front-end request the roster every once in a while and update the UI so that the user doesn't have to refresh the website in order to get the updated roster.

The Mobile CSS is not the best, it also needs to be edited/fixed. Such as the Hour text in the banner cutting off and the name as well.

The link embed, although it is "working", it's not displaying the correct info, this is what is embeded:

<img width="742" height="266" alt="image" src="https://github.com/user-attachments/assets/0d95b13f-f52e-43cd-a4f7-6ed8ce3a86bb" />

and this is what the current Date Ranges are:

<img width="742" height="266" alt="image" src="https://github.com/user-attachments/assets/58dd3ab8-048f-43a6-a8d1-e698dd6b0100" />



Currently, the changes features needs fixing or possibly rewritten. The issue lays in saving some troops when the user doesn't exist in the Database, i haven't been able to figure out why it returns "Saved Troop" but when i check the database, the troop isn't in there. The front-end could also use a bit of a clean-up in terms of code modularity. This could be done by creating separate ejs files for the javascript and then inserting it into the HTML for easier readability.
