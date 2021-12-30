import express from 'express';
import { readFileSync } from 'fs'

const port = 9977;

const __dirname = new URL('.', import.meta.url).pathname;

const PARAM_SHELL_COMMAND = "shellCommand"
const PARAM_INTEGER = "int"
const PARAM_FLOAT = "float"
const PARAM_TEXT = "text"
const PARAM_BOOLEAN = "boolean"
const ACCEPTED_PARAMETER_TYPES = [PARAM_INTEGER, PARAM_FLOAT, PARAM_BOOLEAN, PARAM_TEXT]

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

app.listen(port, () => {
    console.log(`-- Running commands server at port ${port} --\n\n`); 
})