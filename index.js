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

app.get('/api/user', (req, res) => {
    res.status(200).json({
        user: {
            id: 1,
            fullName: 'Rungrot Lertprasert',
            username: 'rungrotl',
            email: 'rungrot@example.com',
            phone: '089-123-4567',
            accountType: 'Personal Plus',
            memberSince: '2026-01-15',
            profileImage: 'https://api.dicebear.com/9.x/initials/svg?seed=Rungrot%20L'
        }
    })
})

app.listen(port, () => {
    console.log(`http://localhost:3000`)
})
