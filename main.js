const { app, Tray, Menu } = require("electron") 
const notifier = require("node-notifier")
const fs = require("fs")
const exec = require("child_process").exec

let tray = null
let config = null
let monitorInterval = null
app.on('ready', () => {
  app.dock.hide()
  readConfig()
  setupTray()
  monitor()
})

function setupTray() {
  let contextMenu = Menu.buildFromTemplate([
    { label: 'Settings' , click() { changeSettings() }},
    { label: 'Quit' , click() { quit() }}
  ])

  tray = new Tray("./battery.png")
  tray.setToolTip("Battery status")
  tray.setTitle("🔋")
  tray.setHighlightMode("never")
  tray.setContextMenu(contextMenu)
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
  computeAndUpdateStatus()
  setInterval(computeAndUpdateStatus, config.polling * 60 * 1000)
}

function computeAndUpdateStatus() {
  getBatteryStatus() 
  .then((info) => {
    if(info.IsCharging == "No") {
      let remainingPercentage = Math.ceil(Number(info.CurrentCapacity) * 100 / Number(info.MaxCapacity))
      let code = remainingPercentage - (remainingPercentage % 10)
      if(config.showPercentage) {
        tray.setTitle(`${remainingPercentage}% ${config['status'][code.toString()]}`)
      } else {
        tray.setTitle(config['status'][code.toString()])
      }
      tray.setToolTip(`Remaining`)
    } else {
      tray.setTitle(config['status']["charging"])
      tray.setToolTip(`Charging`)
    }
  })
}

function changeSettings() {
  tray.setTitle("settings")
}

function notify(message) {
  notifier.notify(message)
}

function quit() {
  if(monitorInterval) {
    clearInterval(monitorInterval)
  }
  app.quit()
}

const requiredBatteryInfo = ["MaxCapacity", "CurrentCapacity", "IsCharging", "TimeRemaining"]
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
