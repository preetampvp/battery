'use strict'
const { ipcRenderer } = require("electron")

document.addEventListener('DOMContentLoaded', () => {
  bindActions()
})

function bindActions() {
  let cancelButton = document.getElementById("cancel")
  cancelButton.addEventListener("click", () => {
    ipcRenderer.send("close-settings")
  })

  let saveButton = document.getElementById("save")
  saveButton.addEventListener("click", () => {
    console.log("save clicked") 
  })
}
