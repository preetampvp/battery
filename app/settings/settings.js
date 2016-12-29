'use strict'
const { ipcRenderer } = require("electron")
//const { homedir } = require("os")
//const fs = require("fs")

let config = null
document.addEventListener('DOMContentLoaded', () => {
  bindActions()
  readConfig()
})

function bindActions() {
  let cancelButton = document.getElementById("cancel")
  cancelButton.addEventListener("click", () => {
    ipcRenderer.send("close-settings")
  })

  let saveButton = document.getElementById("save")
  saveButton.addEventListener("click", () => {
    console.log("save clicked") 
    let statusItems = document.getElementsByClassName("configItem")
    console.log(statusItems)
    for(let i of statusItems) {
      config.status[i.getAttribute("data-key")] = i.value
    }
    console.log(config)
    ipcRenderer.send("save-config", config)
  })
}

function readConfig() {
  ipcRenderer.on('config', (e, args) => {
    config = args
    render() 
  })

  ipcRenderer.send("get-config")
}

function render() {
  let container = document.getElementById("container")
  //console.log(Object.getOwnPropertyDescriptor(config, 'status'))
  // status
  //let headingStatusElem = document.createElement("h5")
  //headingStatusElem.setAttribute("class", "status-heading")
  //headingStatusElem.innerHTML = "Status"
  //container.appendChild(headingStatusElem)
  for(let s in config.status) {
    let divElem = document.createElement("div")
    
    let textElem = document.createElement("div")
    textElem.innerHTML = s === "100" || s === "charging" ? s : `> ${s}`
    textElem.setAttribute("class", "config-text")

    let inputElem = document.createElement("input"); 
    inputElem.value = config.status[s]
    inputElem.setAttribute("class", "configItem")
    inputElem.setAttribute("data-key", s)
    inputElem.setAttribute("type", "text")

    divElem.appendChild(textElem); divElem.appendChild(inputElem)
    container.appendChild(divElem)
  }
  
  
  // other
  //let otherStatusElem = document.createElement("h5")
  //otherStatusElem.setAttribute("class", "other-heading")
  //otherStatusElem.innerHTML = "Other"
  //container.appendChild(otherStatusElem)
  //for(let c in config) {
    //if(c !== "status") {
      //let divElem = document.createElement("div")
      
      //let textElem = document.createElement("div")
      //textElem.innerHTML = c
      //textElem.setAttribute("class", "config-text")

      //let inputElem = document.createElement("input"); 
      //inputElem.value = config[c]
      //inputElem.setAttribute("class", "configItem")
      //inputElem.setAttribute("data-key", c)
      //inputElem.setAttribute("type", "text")

      //divElem.appendChild(textElem); divElem.appendChild(inputElem)
      //container.appendChild(divElem)
    
    //}
  //}
}
