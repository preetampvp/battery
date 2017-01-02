const { app, Tray, Menu, BrowserWindow, ipcMain } = require("electron") 
const notifier = require("node-notifier")
const fs = require("fs")
const exec = require("child_process").exec
const AutoLaunch = require("auto-launch")

let tray = null
let config = null
let monitorInterval = null
let settingsWin = null
let autoLaunch = null

app.on('ready', () => {
  if(!process.env.debug) app.dock.hide()
  if(!process.env.debug) bootstrapAutoLaunch()

  app.on("window-all-closed", (e) => e.preventDefault() )
  readConfig()
  setupTray()
  setupComs()
  monitor()
})


function setupTray() {
  tray = new Tray(`${__dirname}/battery.png`)
  tray.setToolTip("Battery status")
  tray.setTitle("🔋")
  tray.setHighlightMode("never")
}

function setupTrayContextMenu(menuItems) {
  getAutoLaunchEnabledState()
  .then((isAutoLaunchEnabled) => {

    let defaultItems = [
      { label: '⭕️ Refresh' , click() { readConfig();computeAndUpdateStatus() }},
      { label: '⚙ Settings' , click() { changeSettings() }},
      { type: 'separator' },
      { label: 'Start at login', type: 'checkbox', checked: isAutoLaunchEnabled, enabled: canAutoLaunch(), click() { toggleAutoLaunchState() } }, 
      { label: '😵 Restore defaults' , click() { restoreDefaults() }},
      { type: 'separator' },
      { label: '❌ Quit' , click() { quit() }}
    ]

    if(menuItems) {
      defaultItems = [...menuItems, { type: 'separator' }, ...defaultItems]
    }
    
    let contextMenu = Menu.buildFromTemplate(defaultItems)
    tray.setContextMenu(contextMenu)
  })
}

/* Auto launch stuff */
function bootstrapAutoLaunch() {
  let appPath = `${__dirname.substring(0, __dirname.indexOf('BatteryStatus.app'))}/BatteryStatus.app`
  autoLaunch = new AutoLaunch({
    name: 'Battery Status',
    path: appPath 
  })
}

function getAutoLaunchEnabledState() {
  return new Promise((resolve, reject) => {
    if(autoLaunch === null) {
      return resolve(false) 
    }

    autoLaunch.isEnabled()
    .then(resolve)
    .catch(() => {
      resolve(false)
    })
  })
}

function canAutoLaunch() {
  return (autoLaunch !== null)
}

function toggleAutoLaunchState() {
  if(!autoLaunch) return

  autoLaunch.isEnabled()
  .then((isEnabled) => {
    isEnabled === true ? autoLaunch.disable() : autoLaunch.enable() 
    computeAndUpdateStatus()
  })
  .catch(() => {
    notify("Unable to toggle state")
  })
}
/* End of Auto launch stuff */


function setupComs() {
  ipcMain.on("close-settings", (e, args) => {
    if(settingsWin) {
     settingsWin.close()
    }
  })

  ipcMain.on("get-config", (e, args) => {
    e.sender.send("config", config)
  })

  ipcMain.on("save-config", (e, args) => {
    fs.writeFileSync(`${app.getPath("home")}/.battery-status-app.conf`, JSON.stringify(args), 'utf8')
    settingsWin.close()
    readConfig()
    computeAndUpdateStatus()
  })
}

function restoreDefaults() {
  if(settingsWin) { settingsWin.close() }
  let userHomeDir = app.getPath("home")
  let customConfig = `${userHomeDir}/.battery-status-app.conf`
  if(fs.existsSync(customConfig)) {
    fs.unlinkSync(customConfig)
    if(settingsWin) settingsWin.close()
    readConfig()
    computeAndUpdateStatus()
  }
}

function readConfig() {
  let userHomeDir = app.getPath("home")
  let customConfig = `${userHomeDir}/.battery-status-app.conf`
  if(fs.existsSync(customConfig)) {
    config = JSON.parse(fs.readFileSync(customConfig, 'utf8'))
    if(process.env.debug) notify(JSON.stringify(config))
  } else {
    config = JSON.parse(fs.readFileSync(`${__dirname}/config.js`, 'utf8'))
  }
}

function monitor() {
  //changeSettings()
  computeAndUpdateStatus()
  setInterval(computeAndUpdateStatus, config.polling * 60 * 1000)
}

function computeAndUpdateStatus() {
  getBatteryStatus() 
  .then((info) => {
    let remainingPercentage = Math.ceil(Number(info.CurrentCapacity) * 100 / Number(info.MaxCapacity))
    let code = remainingPercentage - (remainingPercentage % 10)

    let timeToFullHrPart = Math.floor(Number(info.AvgTimeToFull) / 60) 
    let timeToFullMinPart = Math.floor(Number(info.AvgTimeToFull) % 60)
    if(timeToFullMinPart.toString().length === 1) timeToFullMinPart = `0${timeToFullMinPart}`
    let timeToFull = timeToFullHrPart < 20 ? `${timeToFullHrPart}:${timeToFullMinPart}` : 'Computing...'
    
    let timeToEmptyHrPart = Math.floor(Number(info.AvgTimeToEmpty) / 60) 
    let timeToEmptyMinPart = Math.floor(Number(info.AvgTimeToEmpty) % 60)
    if(timeToEmptyMinPart.toString().length === 1) timeToEmptyMinPart = `0${timeToEmptyMinPart}`
    let timeToEmpty = timeToEmptyHrPart < 20 ? `${timeToEmptyHrPart}:${timeToEmptyMinPart}` : 'Computing...'

    if(info.IsCharging == "No") {
      tray.setTitle(config['status'][code.toString()])
      tray.setToolTip = `Battery status: ${remainingPercentage}%`
      setupTrayContextMenu([ {label: 'Power source: Battery', enabled: false}, {label: `Juice: ${remainingPercentage}%`, enabled: false }, {label: `Avg. time to empty: ${timeToEmpty}`, enabled: false}])
    } else {
      const charging = config.status.charging
      let title = `${charging}${config['status'][code.toString()]}`
      if(config.wrapCharging) {
        title = `${title}${charging}`
      }
      tray.setTitle(title)
      tray.setToolTip = `Battery status: ${remainingPercentage}% and Charging`
      setupTrayContextMenu([ {label: 'Power source: AC', enabled: false}, {label: `${remainingPercentage}% and Charging`, enabled: false }, {label: `Avg. time to full: ${timeToFull}`, enabled: false} ])
    }
  })
  .catch(() => notify("Error updating batter status"))
}

function changeSettings() {
  if(settingsWin) { return }
  settingsWin = new BrowserWindow({center: true, frame: false, width: 300, height: 530, kiosk: false})
  settingsWin.on('close', () =>  settingsWin = null )
  if(process.env.debug)  settingsWin.webContents.openDevTools()
  settingsWin.loadURL(`file://${__dirname}/app/settings/settings.html`)
  settingsWin.focus()
}

function notify(message) {
  notifier.notify({ title: 'battery', message})
}

function quit() {
  if(monitorInterval) {
    clearInterval(monitorInterval)
  }
  app.quit()
}

const requiredBatteryInfo = ["MaxCapacity", "AvgTimeToFull", "AvgTimeToEmpty", "CurrentCapacity", "IsCharging"]
function getBatteryStatus() {
  return new Promise((resolve, reject) => {
    exec("ioreg -rc AppleSmartBattery", (err, sout, serr) => {
      if(err) {
        notify("error getting battery status")
        resolve()
        return
      } 
      let batteryInfoLines = sout.split("\n")
      let info = {}
      batteryInfoLines.forEach((item) => {
        requiredBatteryInfo.forEach((req) => {
          if(item.includes(req)) {
            let parts = item.split("=")
            info[req] = parts[1].trim()
          } 
        }) 
      })
      resolve(info)
    })
  })
}
