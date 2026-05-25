import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRoutes from './modules/auth/auth.routes'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
}))
app.use(express.json())

app.use('/api/auth', authRoutes)

app.get('/', (req, res) => {
  res.send('SIGSEV API RUNNING')
})

const PORT = Number(process.env.PORT) || 4000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
