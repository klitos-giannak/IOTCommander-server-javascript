import express from 'express';
import { readFileSync } from 'fs'
import { format } from 'util'
import { exec } from 'child_process'
import dgram from 'dgram'
import { hostname } from 'os';

const port = 9977;

const __dirname = new URL('.', import.meta.url).pathname;

const PARAM_SHELL_COMMAND = "shellCommand"
const PARAM_INTEGER = "int"
const PARAM_FLOAT = "float"
const PARAM_TEXT = "text"
const PARAM_BOOLEAN = "boolean"
const ACCEPTED_PARAMETER_TYPES = [PARAM_INTEGER, PARAM_FLOAT, PARAM_BOOLEAN, PARAM_TEXT]
const ACCEPTED_BOOLEAN_TRUE_VALUES = ["true", "t", "1"]
const ACCEPTED_BOOLEAN_FALSE_VALUES = ["false", "f", "0"]
const COMMAND_RESPONSE_BAD_REQUEST_BODY = "<html><body><h1>[400] Bad Request</h1>%s</body></html>\n"
const COMMAND_RESPONSE_OK_BODY = "<html><body><h1>[200] OK</h1><p>Command successful</p></body></html>\n"


let supported_commands = {}

function validateConfig() {
    const file = readFileSync('commands_config.json');
    const json = JSON.parse(file)

    for (const [command, parameters] of Object.entries(json)) {
        
        const shellCommand = parameters.shellCommand
        if (shellCommand == null) {
            console.log('"' + PARAM_SHELL_COMMAND + '" not found for command "' + command + '"')
            return false
        }

        for (const [key, value] of Object.entries(parameters)) {
            if (key != PARAM_SHELL_COMMAND && !ACCEPTED_PARAMETER_TYPES.includes(value)) {
                console.log('Unknown parameter value: "' + value + '" for key "' + key + '"')
                return false
            }
        }
    }
    supported_commands = json
    return true
}

if (!validateConfig()) {
    console.log("commands_config validation failed")
    process.exit()
}

console.log("Supported commands: " + Object.keys(supported_commands))


//Setup and run the commands service
const app = express()

app.get('/', (req, res) => {        
    res.sendFile('index.html', {root: __dirname})
})

app.get('/commands', (req, res) =>  {
    console.log("Supported commands requested. Sending Back Commands config.")

    let clone = JSON.parse(JSON.stringify(supported_commands))
    for (const [command, parameters] of Object.entries(clone)) {
        delete parameters.shellCommand
    }
    res.send(JSON.stringify(clone, null, 2) + "\n")
})

app.get('/command/:commandName', (req, res) => {   
    const command_name = req.params.commandName;

    console.log("Command <" + command_name + "> requested. Trying to parse parameters.")

    // let command =supported_commands[command_name] //use case insensitive key finding below instead
    const command = supported_commands[Object.keys(supported_commands).find(key => key.toLowerCase() === command_name.toLowerCase())];
    if (typeof command === 'undefined') {
        const message = format(COMMAND_RESPONSE_BAD_REQUEST_BODY, "<p>Command not found<p>")
        res.status(400).send(message)
        return
    }
    let shellCommand = command.shellCommand
    console.log("-> " + shellCommand)

    for (const [param, expectedType] of Object.entries(command)) {
        if (param === PARAM_SHELL_COMMAND) {
            continue
        }

        if (req.query.hasOwnProperty(param)){
            const value = req.query[param]
            
            //validate value
            switch(expectedType) {
                case PARAM_TEXT:
                    break
                case PARAM_INTEGER:
                    if (!Number.isSafeInteger(Number.parseInt(value))){
                        const reason = "Unable to convert value of param " + param + " to type " + expectedType
                        sendErrorResponse(reason)
                        return
                    }
                    break
                case PARAM_FLOAT:
                    const number = Number.parseFloat(value);
                    if (Number(number) !== number){
                        const reason = "Unable to convert value of param " + param + " to type " + expectedType
                        sendErrorResponse(reason)
                        return
                    }
                    break
                case PARAM_BOOLEAN:
                    if (getBooleanValue(value) == undefined) {
                        const reason = "Unable to convert value of param " + param + " to type " + expectedType
                        sendErrorResponse(reason)
                        return
                    }
                    break
            }

            shellCommand = shellCommand.replace("$" + param, value)

        } else {
            const reason = "missing param " + param
            sendErrorResponse(reason)
            return
        }
    }

    console.log("Parameters parsed successfully, responding OK\n")

    executeShellCommand(shellCommand);
    res.send(COMMAND_RESPONSE_OK_BODY)


    function sendErrorResponse(reason) {
        console.log(reason + ". Responding with an error.");
        const message = format(COMMAND_RESPONSE_BAD_REQUEST_BODY, `<p>${reason}<p>`);
        res.status(400).send(message);
    }

    function executeShellCommand(cmd) {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    }

    function getBooleanValue(x) {
        if (ACCEPTED_BOOLEAN_TRUE_VALUES.includes(x.toLowerCase())) {
            return true
        } else if (ACCEPTED_BOOLEAN_FALSE_VALUES.includes(x.toLowerCase())) {
            return false
        } else {
            return undefined
        }
    }
})

app.listen(port, () => {
    console.log(`-- Running commands server at port ${port} --\n\n`); 
})

//Broadcast discover service

var server = dgram.createSocket("udp4");
server.bind(port);

// When udp server receive message.
server.on("message", function (message, remoteInfo) {
    console.log("In <-" + remoteInfo.address + ":" + remoteInfo.port + " : " + message)
    const incomingJson = JSON.parse(message)
    if (incomingJson.hasOwnProperty("action") && incomingJson["action"] === "discover") {
        console.log('action "discover" found. Responding...')
        const outgoingMessage = JSON.stringify(createResponseObject())

        server.send(outgoingMessage, remoteInfo.port, remoteInfo.address, null);
        console.log("Out -> " + remoteInfo.address + ":" + remoteInfo.port + " : " + outgoingMessage)
    }
});

// When udp server started and listening.
server.on('listening', function () {
    var address = server.address(); 
    console.log("\n\nBroadcast Server started: listening to port " + address.port + "\n")
});

function createResponseObject() {
    let obj = new Object()
    obj.deviceName = hostname()
    return obj
}