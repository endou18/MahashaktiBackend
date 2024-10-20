const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

// Enable CORS and load environment variables
dotenv.config();

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Atlas connection using Mongoose
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
mongoose.connection.on('connected', () => {
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);
});

// Mongoose schema for Today's Stock
const allTodaysHistorySchema = new mongoose.Schema({
    itemName: { type: String, required: true },
    productGivenTo: { type: String, required: true },
    weight: { type: Number, required: true },
    pieces: { type: Number, default: 0 },
    ornamentType: { type: String, default: 'Gold' },
    date: { type: Date, default: Date.now },
    author: { type: String, required: true },
    status: { type: String, default: 'Deleted' }, // New field for status
    deletionDate:{type: Date},
});
const AllTodaysHistory = mongoose.model('AllTodaysHistory', allTodaysHistorySchema);

const todaysStockSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: true,
    },
    productGivenTo: {
        type: String,
        required: true,
    },
    weight: {
        type: Number,
        required: true,
    },
    pieces: {
        type: Number,
        default: 0,
    },
    ornamentType: {
        type: String,
        enum: ['Gold', 'Silver'],
        default: 'Gold',
    },
    date: {
        type: Date,
        default: Date.now,
    },
    author: {
        type: String,
        required: true,
    },
});

// Create Mongoose model for Today's Stock
const TodaysStock = mongoose.model('TodaysStock', todaysStockSchema);

// API to fetch all Today's Stock records
app.get('/api/todays-stock', async (req, res) => {
    try {
        const stocks = await TodaysStock.find().sort({ date: -1 });
        res.status(200).json(stocks);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch stock data', error });
    }
});
app.delete('/api/todays-stock/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedItem = await TodaysStock.findByIdAndDelete(id);
        if (!deletedItem) {
            return res.status(404).json({ message: 'Stock item not found' });
        }

        // Add the deleted item to "alltodayshistory"
        

        res.status(200).json({ message: 'Stock item deleted and history updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting stock item', error });
    }
  });
app.get('/api/alltodayshistory', async (req, res) => {
try {
    const history = await AllTodaysHistory.find();
    res.status(200).json(history);
} catch (error) {
    res.status(500).json({ message: 'Failed to fetch history data', error });
}
});
// API to add a new history item
app.post('/api/alltodayshistory', async (req, res) => {
    try {
      const { itemName, productGivenTo, weight, pieces, ornamentType, date, author, status, deletionDate } = req.body;
  
      const newHistoryItem = new AllTodaysHistory({
        itemName,
        productGivenTo,
        weight,
        pieces,
        ornamentType,
        date,
        author,
        status,
        deletionDate,
      });
  
      await newHistoryItem.save();
      res.status(201).json({ message: 'History item added successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to add history item', error });
    }
  });
  
// API to add a new Today's Stock record
app.post('/api/todays-stock', async (req, res) => {
    const { itemName, productGivenTo, weight, pieces, ornamentType, author } = req.body;
    console.log('Received data:', req.body)
    if (!itemName || !productGivenTo || !weight || !author) {
        return res.status(400).json({ message: 'Required fields are missing' });
    }

    try {
        const newStock = new TodaysStock({
            itemName,
            productGivenTo,
            weight,
            pieces,
            ornamentType,
            author,
        });

        await newStock.save();
        res.status(201).json({ message: 'Stock added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add stock', error });
    }
});

// Function to fetch gold and silver prices from external source


// API route to get gold and silver prices


// Define Mongoose schema for price updates (history)
const priceHistorySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['gold', 'silver'],
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    updated_at: {
        type: Date,
        default: Date.now, // Automatically stores the time of the update
    },
});

// Create a Mongoose model for PriceHistory
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

// Define Mongoose schema and model for current prices
const Price = mongoose.model('Price', new mongoose.Schema({
    gold_price: Number,
    silver_price: Number,
}));

// API to get the gold and silver prices
app.get('/api/prices', async (req, res) => {
    try {
        const prices = await Price.findOne(); // Assuming you have one document for prices
        res.json(prices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

// API to update gold and silver prices
app.put('/api/prices', async (req, res) => {
    const { gold_price, silver_price } = req.body;
    try {
        // Find the current prices and update them
        const updatedPrices = await Price.findOneAndUpdate(
            {},
            { gold_price, silver_price },
            { new: true, upsert: true } // Update if exists, create new if not
        );

        // Store the price update in the history
        if (gold_price) {
            await new PriceHistory({ type: 'gold', price: gold_price }).save();
        }
        if (silver_price) {
            await new PriceHistory({ type: 'silver', price: silver_price }).save();
        }

        res.json(updatedPrices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update prices' });
    }
});

// API to update only the gold price
app.put('/api/prices/gold', async (req, res) => {
    const { gold_price } = req.body;
  
    if (gold_price === undefined) {
      return res.status(400).json({ error: 'Gold price is required' });
    }
  
    try {
      // Find the current prices and update only the gold price
      const updatedPrices = await Price.findOneAndUpdate(
        {}, // Assuming you have only one document for prices
        { gold_price }, // Update the gold price only
        { new: true, upsert: true } // Return the updated document
      );
  
      // Store the gold price update in the history
      await new PriceHistory({ type: 'gold', price: gold_price }).save();
  
      res.json(updatedPrices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update gold price' });
    }
  });
// API to update only the silver price
app.put('/api/prices/silver', async (req, res) => {
    const { silver_price } = req.body;
  
    if (silver_price === undefined) {
      return res.status(400).json({ error: 'Silver price is required' });
    }
  
    try {
      // Find the current prices and update only the silver price
      const updatedPrices = await Price.findOneAndUpdate(
        {}, // Assuming you have only one document for prices
        { silver_price }, // Update the silver price only
        { new: true, upsert: true } // Return the updated document
      );
  
      // Store the silver price update in the history
      await new PriceHistory({ type: 'silver', price: silver_price }).save();
  
      res.json(updatedPrices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update silver price' });
    }
  });
    
// API to fetch price history (gold and silver updates)
app.get('/api/price-history', async (req, res) => {
    try {
        const priceHistory = await PriceHistory.find().sort({ updated_at: -1 }); // Get all records sorted by latest
        res.json(priceHistory);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch price history' });
    }
});

// Define a Mongoose schema and model for all_stocks
const stockSchema = new mongoose.Schema({
    itemname: String,
    weight: String,
    pieces: String,
    type: String,
    date: String,
    author: String,  // Field to store author or date when stock is added
});

const Stock = mongoose.model('Stock', stockSchema, 'all_stocks');

// API route to fetch all stocks
app.get('/api/stocks', async (req, res) => {
    try {
        const stocks = await Stock.find();
        res.status(200).json(stocks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock data', error });
    }
});
app.delete('/api/stocks/:id', async (req, res) => {
    const { id } = req.params;  // Get the stock item id from the request URL

    try {
        // Find the stock item by id and delete it
        const deletedStock = await Stock.findByIdAndDelete(id);

        if (!deletedStock) {
            return res.status(404).json({ message: 'Stock item not found' });
        }

        // Return a success message if the deletion was successful
        res.status(200).json({ message: 'Stock item deleted successfully' });
    } catch (error) {
        console.error('Error deleting stock item:', error);
        res.status(500).json({ message: 'Failed to delete stock item', error });
    }
});

// PUT request to update a stock item by ID
app.put('/api/stocks/:id', async (req, res) => {
    const { id } = req.params;  // Get the stock item id from the request URL
    const { itemname, weight, pieces, type, author } = req.body;  // Get the updated fields from the request body

    try {
        // Find the stock item by id and update its fields
        const updatedStock = await Stock.findByIdAndUpdate(
            id,
            { itemname, weight, pieces, type, author, date: new Date() },  // Update the fields and set the current date
            { new: true }  // Return the updated document
        );

        if (!updatedStock) {
            return res.status(404).json({ message: 'Stock item not found' });
        }

        // Return the updated stock item
        res.status(200).json(updatedStock);
    } catch (error) {
        console.error('Error updating stock item:', error);
        res.status(500).json({ message: 'Failed to update stock item', error });
    }
});
// API route to add a new stock
app.post('/api/add-stock', async (req, res) => {
    const { itemname, weight, pieces, type, date, author } = req.body;

    try {
        const newStock = new Stock({ itemname, weight, pieces, type, date, author });
        await newStock.save();
        res.status(200).json({ message: 'Stock added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding stock', error });
    }
});

// Define a Mongoose schema and model for credentials
const credentialSchema = new mongoose.Schema({
    username: String,
    password: String,
    name: String,  // Added 'name' field to schema
});

// Updated the model to point to the 'creds' collection
const Credential = mongoose.model('Credential', credentialSchema, 'creds');

// API route to handle login (POST request)
app.post('/api/login', async (req, res) => {
    const { username, password, } = req.body;
    try {
        // Find the user by username and password
        const user = await Credential.findOne({ username, password });

        if (user) {
            // Include the name and username in the response
            res.status(200).json({ username: user.username, name: user.name });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});
// Get user details (GET request)
app.get('/api/user-details', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        console.log('No username provided in request');
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        console.log(`Fetching details for username: ${username}`);
        const user = await Credential.findOne({ username });

        if (user) {
            res.status(200).json({ username: user.username, name: user.name });
        } else {
            console.log('User not found for provided username');
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ message: 'Server error', error });
    }
});


// Update user details (PUT request)
app.put('/api/login', async (req, res) => {
    const { originalUsername, username, password, name } = req.body;

    try {
        // Find the user by the original username and update the details
        const result = await Credential.findOneAndUpdate(
            { username: originalUsername },
            { username, password, name },
            { new: true }
        );

        if (result) {
            res.status(200).json({ message: 'User updated successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});
app.options('*', cors());
// Test route to check if API is running
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Add a catch-all route to handle invalid routes
app.all('*', (req, res) => {
    res.status(404).send('Route not found');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
