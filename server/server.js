import express from 'express'
import cors from 'cors'
import health from './routes/health.js'
import shops from './routes/shops.js'
import products from './routes/products.js'

const app = express()
const port = process.env.PORT || 3001
app.use(cors())
app.use(express.json())
app.use('/api/health', health)
app.use('/api/shops', shops)
app.use('/api/products', products)
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Unable to read marketplace data' }) })
app.listen(port, () => console.log(`Kargil Marketplace API listening on http://localhost:${port}`))
