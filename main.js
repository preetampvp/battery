const { app, Tray, Menu, BrowserWindow, ipcMain } = require("electron") 
const notifier = require("node-notifier")
const fs = require("fs")
const exec = require("child_process").exec

let tray = null
let config = null
let monitorInterval = null
let settingsWin = null

app.on('ready', () => {
  //app.dock.hide()
  app.on("window-all-closed", (e) => e.preventDefault() )
  readConfig()
  setupTray()
  setupComs()
  monitor()
})

function setupTray() {
  tray = new Tray("./battery.png")
  tray.setToolTip("Battery status")
  tray.setTitle("🔋")
  tray.setHighlightMode("never")
}

function setupTrayContextMenu(menuItems) {
  let defaultItems = [
    { label: '⭕️ Refresh' , click() { computeAndUpdateStatus() }},
    { label: '⚙ Settings' , click() { changeSettings() }},
    { type: 'separator' },
    { label: '❌ Quit' , click() { quit() }}
  ]

  if(menuItems) {
    defaultItems = [...menuItems, { type: 'separator' }, ...defaultItems]
  }
  
  let contextMenu = Menu.buildFromTemplate(defaultItems)
  tray.setContextMenu(contextMenu)
}


function setupComs() {
  ipcMain.on("close-settings", (event, args) => {
    if(settingsWin) {
     settingsWin.close()
    }
  })
}

function readConfig() {
  let userHomeDir = app.getPath("home")
  let customConfig = `${userHomeDir}/.battery-status-app.conf`
  if(fs.existsSync(customConfig)) {
    config = require(customConfig) 
  } else {
    config = require("./config.js")
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
    if(info.IsCharging == "No") {
      tray.setTitle(config['status'][code.toString()])
      setupTrayContextMenu([ {label: `${remainingPercentage}% Remaining`, enabled: false } ])
    } else {
      const charging = config.status.charging
      let title = `${charging}${config['status'][code.toString()]}`
      if(config.wrapCharging) {
        title = `${title}${charging}`
      }
      tray.setTitle(title)
      setupTrayContextMenu([ {label: `${remainingPercentage}% Charging`, enabled: false } ])
    }
  })
}

function changeSettings() {
  if(settingsWin) { return }
  settingsWin = new BrowserWindow({center: true, frame: false, width:500, height: 400, kiosk: false})
  settingsWin.on('close', () =>  settingsWin = null )
  settingsWin.webContents.openDevTools()
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

const requiredBatteryInfo = ["MaxCapacity", "DesignCapacity", "CurrentCapacity", "IsCharging", "TimeRemaining"]
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
