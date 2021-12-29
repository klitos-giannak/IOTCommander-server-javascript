import express from 'express';
import fs from 'fs'

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
    let file = fs.readFileSync('commands_config.json');
    let json = JSON.parse(file)

    for (const [command, parameters] of Object.entries(json)) {
        
        let shellCommand = parameters.shellCommand
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
const app = express();

app.get('/', (req, res) => {        
    res.sendFile('index.html', {root: __dirname});       
});

app.listen(port, () => {
    console.log(`-- Running commands server at port ${port} --`); 
});