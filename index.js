const express = require('express')
const app = express();
const port = 3000

app.use(express.json())
app.use(express.static('public/'))

app.post('/api/login', (req, res) => {
    res.status(200).json({ message: 'login success' })
})

app.post('/api/register', (req, res) => {
    res.status(200).json({ message: 'register success' })
})

app.listen(port, () => {
    console.log(`http://localhost:3000`)
})
