import express from 'express';
const app = express();
const port = 9977;

const __dirname = new URL('.', import.meta.url).pathname;

app.get('/', (req, res) => {        
    res.sendFile('index.html', {root: __dirname});       
});

app.listen(port, () => {
    console.log(`Now listening on port ${port}`); 
});