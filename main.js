const { app, Tray } = require('electron') 

let tray = null
app.on('ready', () => {
  //app.dock.hide()
  tray = new Tray("./battery.png")
  tray.setToolTip("Battery status")
  tray.setTitle("🔋")
})
